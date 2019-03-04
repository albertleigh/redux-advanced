import { Dispatch } from "redux";
import {
  ActionsObservable,
  Epic as ReduxObservableEpic,
  StateObservable
} from "redux-observable";
import { empty, Observable } from "rxjs";
import { mergeMap, takeUntil } from "rxjs/operators";

import {
  ActionHelpers,
  AnyAction,
  ConvertActionHelpersToStrictActionHelpers
} from "./action";
import { StoreCache } from "./cache";
import { UseStrictContainer } from "./container";
import { Model } from "./model";
import { Getters } from "./selector";

import { actionTypes } from "./action";
import { parseActionType } from "./util";

export type EffectDispatch<TResult = any> = (
  dispatch: Dispatch<AnyAction>
) => Promise<TResult>;

export interface EffectContext<
  TDependencies = any,
  TProps = any,
  TState = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any
> {
  rootAction$: ActionsObservable<AnyAction>;
  rootState$: StateObservable<unknown>;

  namespace: string;

  dependencies: TDependencies;
  props: TProps;
  key: string;

  getState: () => TState;
  getters: TGetters;
  actions: ConvertActionHelpersToStrictActionHelpers<TActionHelpers>;

  useContainer: UseStrictContainer;
}

export type Effect<
  TDependencies = any,
  TProps = any,
  TState = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any,
  TPayload = any,
  TResult = any
> = (
  context: EffectContext<
    TDependencies,
    TProps,
    TState,
    TGetters,
    TActionHelpers
  >,
  payload: TPayload
) => EffectDispatch<TResult>;

export interface Effects<
  TDependencies = any,
  TProps = any,
  TState = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any
> {
  [name: string]: Effect<
    TDependencies,
    TProps,
    TState,
    TGetters,
    TActionHelpers
  >;
}

export type ExtractEffects<T extends Model> = T extends Model<
  any,
  any,
  any,
  any,
  any,
  infer TEffects
>
  ? TEffects
  : never;

export type ExtractEffectResult<T extends Effect> = T extends Effect<
  any,
  any,
  any,
  any,
  any,
  any,
  infer TResult
>
  ? TResult
  : never;

export function toActionObservable(
  effectDispatch: EffectDispatch
): Observable<AnyAction> {
  return new Observable((subscribe) => {
    const dispatch: Dispatch = (action) => {
      subscribe.next(action);
      return action;
    };
    effectDispatch(dispatch).then(
      () => subscribe.complete(),
      (reason) => subscribe.error(reason)
    );
  });
}

export function createEffectsRootReduxObservableEpic(
  storeCache: StoreCache
): ReduxObservableEpic {
  return (rootAction$, rootState$) =>
    rootAction$.pipe(
      mergeMap((action) => {
        const actionType = "" + action.type;
        const { namespace, key } = parseActionType(actionType);

        const container = storeCache.containerByNamespace.get(namespace);
        if (container == null) {
          return empty();
        }

        const effect = container.model.effects[key] as Effect;
        if (effect == null) {
          return empty();
        }

        const effectDispatchHandler = storeCache.effectDispatchHandlerByAction.get(
          action
        );
        if (effectDispatchHandler != null) {
          effectDispatchHandler.hasEffect = true;
        }

        const effectDispatch = effect(
          {
            rootAction$,
            rootState$,

            namespace,

            dependencies: storeCache.dependencies,
            props: container.props,
            key: container.key,

            getState: () => container.state,
            getters: container.getters,
            actions: container.actions,

            useContainer: storeCache.useContainer as UseStrictContainer
          },
          action.payload
        );

        const wrappedEffectDispatch = (dispatch: Dispatch) => {
          let promise = effectDispatch(dispatch);

          promise.then(
            (value) => {
              if (effectDispatchHandler != null) {
                effectDispatchHandler.resolve(value);
              }
            },
            (reason) => {
              if (effectDispatchHandler != null) {
                effectDispatchHandler.reject(reason);
              }
            }
          );

          if (storeCache.options.effectErrorHandler != null) {
            promise = promise.catch((reason) =>
              storeCache.options.effectErrorHandler!(reason, dispatch)
            );
          }

          return promise;
        };

        const takeUntil$ = rootAction$.ofType(
          `${namespace}/${actionTypes.unregister}`
        );

        const output$ = toActionObservable(wrappedEffectDispatch).pipe(
          takeUntil(takeUntil$)
        );

        return output$;
      })
    );
}
