import {
  applyMiddleware,
  createStore,
  Middleware,
  Reducer,
  Store,
} from "redux";
import { createEpicMiddleware, Epic } from "redux-observable";
import { mergeMap, switchMap } from "rxjs/operators";
import { default as createSagaMiddleware } from "redux-saga";
import { Saga } from "@redux-saga/types";
import { SagaMiddleware } from "@redux-saga/core";
import { registerActionHelper, reloadActionHelper } from "./action";
import { Container, GetContainer } from "./container";
import { createStoreContext } from "./context";
import { createMiddleware } from "./middleware";
import { Models, registerModels } from "./model";
import { createReduxReducer } from "./reducer";
import { rootSagaBuilder } from "./saga";

export interface ReduxAdvancedOptions {
  dependencies: any;

  createStore?: (context: {
    reducer: Reducer;
    epic: Epic;
    middleware: Middleware;
    saga?: Saga;
  }) => Store;

  resolveActionName?: (paths: string[]) => string;

  onUnhandledEffectError?: (error: any) => void;
  onUnhandledEpicError?: (error: any) => void;

  enableSaga?: boolean | undefined;
}

export interface ReduxAdvancedInstance {
  store: Store;
  getContainer: GetContainer;
  registerModels: (models: Models) => void;
  reload: (state?: any) => void;
  gc: (fn?: (container: Container) => boolean) => void;
}

export function init(options: ReduxAdvancedOptions): ReduxAdvancedInstance {
  const storeContext = createStoreContext();
  storeContext.options = options;

  const rootReducer: Reducer = createReduxReducer(storeContext);
  const rootEpic: Epic = (action$, state$, ...rest) =>
    storeContext.switchEpic$.pipe(
      switchMap(() =>
        storeContext.addEpic$.pipe(
          mergeMap((epic) => epic(action$, state$, ...rest))
        )
      )
    );
  const middleware = createMiddleware(storeContext);

  if (options.createStore) {
    storeContext.store = options.createStore({
      reducer: rootReducer,
      epic: rootEpic,
      middleware,
      saga: options.enableSaga ? rootSagaBuilder(storeContext) : undefined,
    });
  } else {
    const epicMiddleware = createEpicMiddleware();
    let enhancer;
    let sagaMiddleware: SagaMiddleware<any> | undefined;
    if (options.enableSaga) {
      sagaMiddleware = createSagaMiddleware();
      enhancer = applyMiddleware(middleware, epicMiddleware, sagaMiddleware);
    } else {
      enhancer = applyMiddleware(middleware, epicMiddleware);
    }

    storeContext.store = createStore(rootReducer, enhancer);
    epicMiddleware.run(rootEpic);
    sagaMiddleware && sagaMiddleware!.run(rootSagaBuilder(storeContext));
  }

  storeContext.switchEpic$.next();

  return {
    store: storeContext.store,
    getContainer: storeContext.getContainer,
    registerModels: (models) => {
      const registerOptionsList = registerModels(storeContext, "", models);
      storeContext.store.dispatch(
        registerActionHelper.create(registerOptionsList)
      );
    },
    reload: (state) => {
      storeContext.store.dispatch(reloadActionHelper.create({ state }));
    },
    gc: (fn) => {
      if (!fn) {
        fn = (container) => !container.isRegistered;
      }

      const containers: Container[] = [];

      storeContext.contextByModel.forEach((context) => {
        context.containerByKey.forEach((container) => {
          if (fn!(container)) {
            containers.push(container);
          }
        });
      });

      containers.forEach((container) => {
        container.unregister();
      });
    },
  };
}
