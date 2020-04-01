import { StrictEffect } from "@redux-saga/types"
import { takeEvery } from "redux-saga/effects"
import { Getters } from "./selector";
import {
  ActionHelpers,
  ActionWithFields,
  AnyAction,
  ExtractActionDispatchResult,
  ExtractActionPayload,
} from "./action";
import { GetContainer } from "./container";
import { Model } from "./model";
import { StoreContext } from "./context";
import { splitLastPart } from "./util";

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
  action: ActionWithFields<TPayload,{context: SagaContext}>
) => unknown & {[Symbol.iterator](): Iterator<StrictEffect,TResult,ActionWithFields<TPayload,{context: SagaContext}>>};

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
    : OverrideSagas<TSagas[P], TDependencies, TState, TGetters, TActionHelpers>
}


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
  return function* rootSaga() {
    yield takeEvery("*",function* globalInterceptor( action: AnyAction){
      const [namespace, actionName] = splitLastPart(action.type);
      const container = storeCtx.containerByNamespace.get(namespace);
      if (container && container.isRegistered){
        const theSaga = storeCtx.contextByModel.get(container!.model)?.sagaEffectByActionName.get(actionName);
        if (theSaga){
          const deferred = storeCtx.deferredByAction.get(action);
          const newAction = action as ActionWithFields<any,{context: SagaContext}>;
          newAction.context = container.sagaContext;
          try{
            deferred?.resolve( yield* theSaga(newAction) );
          }catch (e) {
            deferred?.reject(e);
          }
        }
      }
    })
  }
}
