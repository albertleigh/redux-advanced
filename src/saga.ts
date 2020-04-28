import { StrictEffect } from "@redux-saga/types";
import { all, cancel, fork, spawn, take, takeEvery } from "redux-saga/effects";
import { Getters } from "./selector";
import {
  actionTypes,
  Action,
  ActionHelpers,
  AnyAction,
  ExtractActionDispatchResult,
  ExtractActionPayload,
  RegisterOptions,
  UnregisterOptions,
} from "./action";
import { ContainerImpl, GetContainer } from "./container";
import { Model } from "./model";
import { StoreContext } from "./context";
import { splitLastPart } from "./util";

export type SagaAction<P = any> = Action<P>;

export interface SagaContext<
  TDependencies = any,
  TState extends object = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any
> {
  dependencies: TDependencies;

  baseNamespace: string;
  key: string | undefined;
  modelIndex: number | undefined;

  getState: () => TState;
  getters: TGetters;
  actions: TActionHelpers;

  getContainer: GetContainer;
}

export type SagaEffect<
  TDependencies = any,
  TState extends object = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any,
  TPayload = any,
  TResult = any
> = (
  ctx: SagaContext<TDependencies, TState, TGetters, TActionHelpers>,
  pl: TPayload
) => Generator<StrictEffect, TResult, SagaAction<TPayload> | any[] | any>;

export interface SagaEffects<
  TDependencies = any,
  TState extends object = any,
  TGetters extends Getters = any,
  TActionHelpers extends ActionHelpers = any
> {
  [name: string]:
    | SagaEffect<TDependencies, TState, TGetters, TActionHelpers>
    | SagaEffects<TDependencies, TState, TGetters, TActionHelpers>;
}

export type ExtractSagaEffects<T extends Model> = T extends Model<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  infer TSagas
>
  ? TSagas
  : never;

export type OverrideSagas<
  TSagas,
  TDependencies,
  TState extends object,
  TGetters extends Getters,
  TActionHelpers extends ActionHelpers
> = {
  [P in keyof TSagas]: TSagas[P] extends (...args: any[]) => any
    ? SagaEffect<
        TDependencies,
        TState,
        TGetters,
        TActionHelpers,
        ExtractActionPayload<TSagas[P]>,
        ExtractActionDispatchResult<TSagas[P]>
      >
    : OverrideSagas<TSagas[P], TDependencies, TState, TGetters, TActionHelpers>;
};

export type LooseSagaEffects<TSagaEffects> = {
  [P in keyof TSagaEffects]: TSagaEffects[P] extends (...args: any[]) => any
    ? SagaEffect<
        any,
        any,
        any,
        any,
        ExtractActionPayload<TSagaEffects[P]>,
        ExtractActionDispatchResult<TSagaEffects[P]>
      >
    : LooseSagaEffects<TSagaEffects[P]>;
};

export function rootSagaBuilder(storeCtx: StoreContext) {
  function* _doSpawnEntries(
    context: SagaContext,
    action: Action,
    entrySagaEffects: SagaEffect[],
    baseNamespace: string,
    key?: string
  ) {
    const allTasks = yield all(
      entrySagaEffects.map((saga) => fork(saga as any, context, action.payload))
    );

    while (true) {
      const action = (yield take(actionTypes.unregister)) as Action<
        UnregisterOptions[]
      >;
      if (
        action.payload.some(
          (option) =>
            option.baseNamespace === baseNamespace && option.key === key
        )
      ) {
        break;
      }
    }

    yield all(allTasks.map((task: any) => cancel(task)));
  }

  function* registerEntriesHandler(action: Action<RegisterOptions[]>) {
    const optionList = action.payload;

    for (const options of optionList) {
      const { baseNamespace, key, modelIndex } = options;
      const models = storeCtx.modelsByBaseNamespace.get(baseNamespace);
      if (models == null) {
        throw new Error(
          `Failed to register container: no model found for namespace "${baseNamespace}"`
        );
      }
      const model = models[modelIndex ?? 0];
      const modelCtx = storeCtx.contextByModel.get(model);
      const container = storeCtx.getContainer(model, key!) as ContainerImpl;
      const entrySagaEffects: SagaEffect[] = [];
      modelCtx!.sagaEffectByActionName.forEach((oneSaga, key) => {
        if (key.indexOf("$$") !== -1) {
          entrySagaEffects.push(oneSaga);
        }
      });
      if (entrySagaEffects.length > 0) {
        yield spawn(
          _doSpawnEntries,
          container.sagaContext,
          action,
          entrySagaEffects,
          baseNamespace,
          key
        );
      }
    }
  }

  return function* defaultHandler() {
    yield all([
      takeEvery(actionTypes.register, registerEntriesHandler),
      takeEvery("*", function* defaultInterceptor(action: AnyAction) {
        const [namespace, actionName] = splitLastPart(action.type);
        const container = storeCtx.containerByNamespace.get(namespace);
        if (container && container.isRegistered) {
          const theSaga = storeCtx.contextByModel
            .get(container!.model)
            ?.sagaEffectByActionName.get(actionName);
          // any action name containing _$ or $$ would be regarded as customized saga
          // or root saga wont be yielded by default;
          if (!!theSaga) {
            const deferred = storeCtx.deferredByAction.get(action);
            if (actionName.match(/.*[$_]\$.*/g)) {
              deferred?.resolve({});
            } else {
              const newAction = {} as SagaAction<typeof action.payload>;
              newAction.type = action.type;
              newAction.payload = action.payload;
              try {
                const result = yield* theSaga(
                  container.sagaContext,
                  newAction.payload
                );
                deferred?.resolve(result);
              } catch (e) {
                deferred?.reject(e);
              }
            }
          }
        }
      }),
    ]);
  };
}
