import { Store } from "redux";
import { Epic as ReduxObservableEpic } from "redux-observable";
import { Observable, Subject } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";
import { AnyAction } from "./action";
import { ContainerImpl, createGetContainer, GetContainer } from "./container";
import { Effect } from "./effect";
import { Model } from "./model";
import { Reducer } from "./reducer";
import { SagaEffect } from "./saga";
import { ReduxAdvancedOptions } from "./store";
import { nothingToken } from "./util";

export interface ModelContext {
  isDynamic: boolean;
  modelIndex: number | undefined;

  baseNamespace: string;
  basePath: string;

  reducerByActionName: Map<string, Reducer>;
  effectByActionName: Map<string, Effect>;
  sagaEffectByActionName: Map<string, SagaEffect>;

  containerByKey: Map<string | undefined, ContainerImpl>;
}

export interface StoreContext {
  store: Store;
  options: ReduxAdvancedOptions;

  getContainer: GetContainer;

  addEpic$: Subject<ReduxObservableEpic>;
  switchEpic$: Subject<void>;

  reducerRootState: any;

  rootActionSubject: Subject<AnyAction>;
  rootAction$: Observable<AnyAction>;
  rootStateSubject: Subject<any>;
  rootState$: Observable<any>;

  contextByModel: Map<Model, ModelContext>;
  modelsByBaseNamespace: Map<string, Model[]>;
  containerByNamespace: Map<string, ContainerImpl>;
  deferredByAction: WeakMap<
    AnyAction,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >;

  getDependencies: () => any;
  resolveActionName: (paths: string[]) => string;
  onUnhandledEffectError: (error: any) => void;
  onUnhandledEpicError: (error: any) => void;
}

export function createStoreContext(): StoreContext {
  const rootActionSubject = new Subject<AnyAction>();
  const rootAction$ = rootActionSubject;

  const rootStateSubject = new Subject<any>();
  const rootState$ = rootStateSubject.pipe(distinctUntilChanged());

  const storeContext: StoreContext = {
    store: undefined!,
    options: undefined!,

    getContainer: undefined!,

    addEpic$: new Subject(),
    switchEpic$: new Subject(),

    reducerRootState: nothingToken,

    rootActionSubject,
    rootAction$,
    rootStateSubject,
    rootState$,

    contextByModel: new Map(),
    modelsByBaseNamespace: new Map(),
    containerByNamespace: new Map(),
    deferredByAction: new WeakMap(),

    getDependencies: () => {
      return storeContext.options.dependencies;
    },
    resolveActionName: (paths) => {
      return storeContext.options.resolveActionName?.(paths) ?? paths.join(".");
    },
    onUnhandledEffectError: (error) => {
      if (storeContext.options.onUnhandledEffectError) {
        storeContext.options.onUnhandledEffectError(error);
      } else {
        console.error(error);
      }
    },
    onUnhandledEpicError: (error) => {
      if (storeContext.options.onUnhandledEpicError) {
        storeContext.options.onUnhandledEpicError(error);
      } else {
        console.error(error);
      }
    },
  };

  storeContext.getContainer = createGetContainer(storeContext);

  return storeContext;
}
