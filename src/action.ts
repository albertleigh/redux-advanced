import { StrictEffect } from "@redux-saga/types";
import { apply } from "redux-saga/effects";
import { ContainerImpl } from "./container";
import { StoreContext } from "./context";
import {
  ExtractSagaEffects,
  SagaContext,
  SagaEffect,
  SagaEffects,
} from "./saga";
import { Effect, Effects, ExtractEffects } from "./effect";
import { Model } from "./model";
import { ExtractReducers, Reducer, Reducers } from "./reducer";
import {
  assignObjectDeeply,
  joinLastPart,
  merge,
  PatchedPromise,
  splitLastPart,
} from "./util";

export interface AnyAction {
  type: string;
  payload?: any;
}

export interface Action<TPayload = any> {
  type: string;
  payload: TPayload;
}

export type ActionWithFields<TPayload, TFieldsObj> = Action<TPayload> &
  TFieldsObj;

export interface ActionHelper<TPayload = any, TResult = any> {
  type: string;
  is(action: any): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): Promise<TResult>;
  saga(
    payload: TPayload
  ): { [Symbol.iterator](): Iterator<StrictEffect, TResult, Action<unknown>> };
}

export interface ActionHelpers {
  [name: string]: ActionHelper | ActionHelpers;
}

export type ExtractActionPayload<
  T extends Action | ActionHelper | Reducer | Effect
> = T extends
  | Action<infer TPayload>
  | ActionHelper<infer TPayload, any>
  | Reducer<any, any, infer TPayload>
  | Effect<any, any, any, any, infer TPayload, any>
  | SagaEffect<any, any, any, any, infer TPayload, any>
  ? TPayload
  : never;

export type ExtractActionDispatchResult<
  T extends ActionHelper | Effect
> = T extends
  | ActionHelper<any, infer TResult>
  | Effect<any, any, any, any, any, infer TResult>
  | SagaEffect<any, any, any, any, any, infer TResult>
  ? TResult
  : never;

export type ExtractActionHelperPayloadResultPairs<
  T extends Reducers | Effects
> = {
  [P in keyof T]: T[P] extends (...args: any[]) => any
    ? [
        ExtractActionPayload<T[P]>,
        T[P] extends Effect ? ExtractActionDispatchResult<T[P]> : unknown
      ]
    : T[P] extends {}
    ? ExtractActionHelperPayloadResultPairs<T[P]>
    : never;
};

export type ExtractActionHelpersFromPayloadResultPairs<T> = {
  [P in keyof T]: T[P] extends any[]
    ? ActionHelper<T[P][0], T[P][1]>
    : T[P] extends {}
    ? ExtractActionHelpersFromPayloadResultPairs<T[P]>
    : never;
};

export type ExtractActionHelpers<
  TReducers extends Reducers,
  TEffects extends Effects,
  TSagas extends SagaEffects
> = ExtractActionHelpersFromPayloadResultPairs<
  ExtractActionHelperPayloadResultPairs<TReducers> &
    ExtractActionHelperPayloadResultPairs<TEffects> &
    ExtractActionHelperPayloadResultPairs<TSagas>
>;

export class ActionHelperImpl<TPayload = any, TResult = any>
  implements ActionHelper<TPayload, TResult> {
  constructor(
    private readonly _storeContext: StoreContext,
    private readonly _container: ContainerImpl,
    public readonly type: string
  ) {}

  public is(action: any): action is Action<TPayload> {
    return action?.type === this.type;
  }

  public create(payload: TPayload): Action<TPayload> {
    const action = {
      type: this.type,
      payload,
    };
    // todo move ctx to this.create
    const [, actionName] = splitLastPart(this.type);
    if (
      this._storeContext &&
      this._storeContext.contextByModel
        .get(this._container.model)
        ?.sagaEffectByActionName.has(actionName)
    ) {
      (action as ActionWithFields<
        TPayload,
        { context: SagaContext }
      >).context = this._container.sagaContext;
    }
    return action;
  }

  public dispatch(payload: TPayload): Promise<TResult> {
    if (
      this._container.canRegister &&
      this._container.model.options.autoRegister
    ) {
      this._container.register();
    }

    const action = this.create(payload);

    const promise = new PatchedPromise<TResult>((resolve, reject) => {
      this._storeContext.deferredByAction.set(action, {
        resolve,
        reject: (reason) => {
          reject(reason);
          Promise.resolve().then(() => {
            if (!promise.hasRejectionHandler) {
              promise.then(
                undefined,
                this._storeContext.onUnhandledEffectError
              );
            }
          });
        },
      });
    });

    this._storeContext.store.dispatch(action);

    return promise;
  }

  get saga() {
    const self = this;

    if (
      this._container.canRegister &&
      this._container.model.options.autoRegister
    ) {
      this._container.register();
    }

    const [, actionName] = splitLastPart(this.type);
    const theSaga = this._storeContext.contextByModel
      .get(this._container.model)
      ?.sagaEffectByActionName.get(actionName);
    if (!!theSaga) {
      return function* (payload: TPayload){
        let arg;
        if (!!(payload as any)['context']) {
          arg = self.create((payload as any).payload) as ActionWithFields<
            TPayload,
            { context: SagaContext }
            >;
        }else {
          arg = self.create(payload) as ActionWithFields<
            TPayload,
            { context: SagaContext }
            >;
        }
        return yield* theSaga(arg);
      };
    } else {
      // cheap compatible solution, should be avoided via call(action.dispatch, {})
      return function*(payload: TPayload) {
        return yield apply(self, "dispatch", [payload] as any);
      };
    }
  }
}

export function createActionHelpers<TModel extends Model>(
  storeContext: StoreContext,
  container: ContainerImpl<TModel>
): ExtractActionHelpers<
  ExtractReducers<TModel>,
  ExtractEffects<TModel>,
  ExtractSagaEffects<TModel>
> {
  const actionHelpers: ActionHelpers = {};

  assignObjectDeeply(
    actionHelpers,
    merge(
      {},
      container.model.reducers,
      container.model.effects,
      container.model.sagas
    ),
    (o, paths) =>
      new ActionHelperImpl(
        storeContext,
        container,
        joinLastPart(container.namespace, storeContext.resolveActionName(paths))
      )
  );

  return actionHelpers as any;
}

export interface RegisterOptions {
  baseNamespace: string;
  key?: string;
  modelIndex?: number;
  args?: any;
  state?: any;
}

export interface UnregisterOptions {
  baseNamespace: string;
  key?: string;
}

export interface ReloadOptions {
  state?: any;
}

export const actionTypes = {
  register: "@@REGISTER",
  unregister: "@@UNREGISTER",
  reload: "@@RELOAD",
};

export const registerActionHelper = new ActionHelperImpl<
  RegisterOptions[],
  void
>(undefined!, undefined!, actionTypes.register);

export const unregisterActionHelper = new ActionHelperImpl<
  UnregisterOptions[],
  void
>(undefined!, undefined!, actionTypes.unregister);

export const reloadActionHelper = new ActionHelperImpl<ReloadOptions, void>(
  undefined!,
  undefined!,
  actionTypes.reload
);
