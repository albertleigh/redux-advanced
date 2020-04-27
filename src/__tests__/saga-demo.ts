import { createModelBuilder, init, SGA } from "../index";
import { apply, call, cancel, cancelled, delay, fork, put, putResolve, take, takeLatest } from "redux-saga/effects";
import { ofType } from 'redux-observable';
import { tap, takeUntil, mergeMap } from "rxjs/operators";
import { ajax } from "rxjs/ajax";
import { Observable, of } from "rxjs";

interface Dependencies {
  appName: string;
}

const defaultModelBuilder = createModelBuilder()
  .dependencies<Dependencies>()
  .freeze();

describe("saga api demo purpose test cases", ()=>{

  // first of all, a new effect group called sagas is added
  // basically if functions almost the same as previous effects group
  it("simple example", async()=>{

    const someFun = jest.fn().mockImplementation((str: string)=>{
      console.log("[mocked::someFun]",str);
    })

    const dependencies: Dependencies = { appName: "simple" };

    const basicModel = defaultModelBuilder
      .sagas({
        helloSaga: function*() {
          yield delay(100);
          someFun("hello saga effect via generator");
        }
      })
      .build();

    // by default saga effects are not enabled, thus init gonna need an
    // enableSaga opt to be true to init saga middleware
    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    // still we can dispatch saga effect like thunk effect before
    await basicCtn.actions.helloSaga.dispatch({})

    // function called, console logged to and the effect mission cleared
    expect(someFun).toBeCalled();

    // by default, all un specific effect names will be `takeEvery`ed as it
    // would usually be the most common use cases

  })

  // benefits of using saga effect: saga effects can be regarded as the
  // combination of thunk effect and rx-observable, with saga effect it no
  // longer need to code in two separated groups to achieve one certain feature.
  // additionally, comparing thunk w/ observable, saga requires less codes to
  // achieve a equivalent functionally, in a nutshell,
  // the less codes the less troubles
  it("complex example", async()=> {
    // before we dig in there are two reserved pattern utilized by saga groups
    // 1) any saga "_$" in the path chain will be regarded as self handled saga
    //  middleware won't intercept it by default
    // 2) any saga "$$" in the path chain will be regarded as onInit handled saga
    //  middleware will execute the saga once the module registered
    // 3) by default the saga of the rest path pattern would be 'takeEvery'ed
    // in another word, its corresponding saga will be executed for every single
    // time the action dispatched

    // the first input parameter of the saga will be the action object intercepted
    // the `context` field will be the same context needed by the thunk effect

    // each of the action impl of the `actions` handler of the effect context
    // will bear another method  saga(payload):Generator, through which, the
    // corresponding saga effect will be returned, and it input parameter will
    // be the type of payload instead of the whole action, redux-advance will
    // help you handle the creation of the action
    // for the thunk effect, a on-the-fly created generator with an call effect
    // of that promise will be created and returned for compatibility

    const basicModel = defaultModelBuilder
      .state(() => ({
        name: "",
        age: 0,
      }))
      .reducers({
        setName(state, payload: string) {
          state.name = payload;
        },
        setAge(state, payload: number) {
          state.age = payload;
        },
      })
      .sagas({
        changeAll: function*(action) {
          const { actions } = action.context;
          yield put(actions.setName.create("basicName"));
          yield put(actions.setAge.create(1));
        },
        _$customChange: function*(action) {
          const { actions, getState } = action.context;
          yield put(actions.setName.create(getState().name + "_custom"));
          yield put(actions.setAge.create(getState().age + 1));
        },
        _$tkeLatestChange: function*(action) {
          const { actions, getState } = action.context;
          yield put(actions.setName.create(getState().name + "_latest"));
          yield put(actions.setAge.create(getState().age + 2));
        },
      })
      .sagas({
        $$rootRoot: function*(action) {
          const { actions } = action.context;
          yield takeLatest(
            actions._$tkeLatestChange.type,
            actions._$tkeLatestChange.saga
          );
          const custemAct = yield take(actions._$customChange.type);
          yield* actions._$customChange.saga(custemAct.payload);
        },
      })
      .build();

    const dependencies: Dependencies = { appName: "complex" };

    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });

    const basicCtn = getContainer(basicModel);

    expect(basicCtn.getState().age).toBe(0);
    expect(basicCtn.getState().name).toBe("");

    await basicCtn.actions.changeAll.dispatch({});

    expect(basicCtn.getState().age).toBe(1);
    expect(basicCtn.getState().name).toBe("basicName");

    await basicCtn.actions._$customChange.dispatch({});

    expect(basicCtn.getState().age).toBe(2);
    expect(basicCtn.getState().name).toBe("basicName_custom");

    await basicCtn.actions._$customChange.dispatch({});
    // won't change this time
    expect(basicCtn.getState().age).toBe(2);
    expect(basicCtn.getState().name).toBe("basicName_custom");

    await basicCtn.actions._$tkeLatestChange.dispatch({});
    expect(basicCtn.getState().age).toBe(4);
    expect(basicCtn.getState().name).toBe("basicName_custom_latest");

    await basicCtn.actions._$tkeLatestChange.dispatch({});
    expect(basicCtn.getState().age).toBe(6);
    expect(basicCtn.getState().name).toBe("basicName_custom_latest_latest");

  })

  // hybrid example
  it("hybrid example", async()=>{

    const someFun = jest.fn().mockImplementation((str: string)=>{
      console.log("[mocked::someFun]",str);
    })

    const dependencies: Dependencies = { appName: "hybrid" };

    const basicModel = defaultModelBuilder
      .effects({
        thunkTask: async (ctx, payload: {py: string})=>{
          return await new Promise<{result: string}>((res)=>{
            setTimeout(()=>{
              someFun(payload.py);
              res({ result: "thunk task cleared" })
            }, 100);
          })
        }

      })
      .sagas({
        sagaTask: function*(action) {
          const { actions } = action.context;

          // the payload of thunk effect would be typed
          // uncomment to check the type err
          // typed err
          // yield apply(actions.thunkTask, "dispatch", [{py2: "py str"}]);

          // since actions is an class with class context, better use apply to
          // keep the context
          const res = yield apply(actions.thunkTask, "dispatch", [{py: "py str"}]);

          expect(res.result).toBeDefined();
          // todo: Oops the result type has been wiped out by apply effect ....
          // maybe a helper converter can help to keep the type, i will think about it
          expect(res.result2).toBeUndefined();
          expect(res.result).toBeDefined();

        }
      })
      .build();

    // by default saga effects are not enabled, thus init gonna need an
    // enableSaga opt to be true to init saga middleware
    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    // still we can dispatch saga effect like thunk effect before
    await basicCtn.actions.sagaTask.dispatch({})

    // function called, console logged to and the effect mission cleared
    expect(someFun).toBeCalled();

    // by default, all un specific effect names will be `takeEvery`ed as it
    // would usually be the most common use cases

  })


  // unregistered example
  it("unregistered example", async ()=>{

    const FAKE_ACT_NAME = "FAKE_ACT_NAME";
    const fakeActCreator = ()=> ({
      type: FAKE_ACT_NAME,
      payload: {}
    })

    let oneSagaTaskCtn = 0;

    const staticModel = defaultModelBuilder
      .build();
    const dynamicModel = defaultModelBuilder
      .sagas({
        _$oneSagaTask: function*() {
          oneSagaTaskCtn++;
          yield delay(100);
        }

      })
      .sagas({
        $$rootEntry: function*(action) {
          const {actions} = action.context;
          yield takeLatest(FAKE_ACT_NAME, actions._$oneSagaTask.saga);
        }
      })
      .build();

    const dependencies: Dependencies = {appName: 'unregistered'}

    const { getContainer, registerModels, gc, store } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({
      stat: staticModel,
      dyn: [dynamicModel]
    });

    const dynCtn = getContainer(dynamicModel, "1");

    // dynamic model not registered yet, won't trigger the saga
    store.dispatch(fakeActCreator());
    expect(oneSagaTaskCtn).toBe(0);

    dynCtn.register();

    // dynamic model registered yet, will trigger the saga
    store.dispatch(fakeActCreator());
    expect(oneSagaTaskCtn).toBe(1);

    dynCtn.unregister();

    // dynamic model unregistered yet, won't trigger the saga
    store.dispatch(fakeActCreator());
    expect(oneSagaTaskCtn).toBe(1);
  })

  // another key concern of redux-advanced is implying typing, new saga
  // effect group also keep those in minds, at least will bear all the
  // typing implying that thunk effect group has
  it("typing example", async()=> {

    const basicModel = defaultModelBuilder
      .sagas({
        task01:function*() {
          const millsToDelay = 218;
          yield delay(millsToDelay);
          return {
            typ: 'task01',
            millsToDelay,
          }
        },
        task02:function*(action: SGA<{
          extraField: string;
        }>) {
          const py = action.payload;
          const millsToDelay = 220;
          yield delay(millsToDelay);
          return {
            typ: 'task02',
            millsToDelay,
            extra: py.extraField

          }
        },
      })
      .sagas({
        task04:function* (action){
          const { actions } = action.context;

          // the payload of saga generator would be typed
          // uncomment to check the type err
          // typed err
          // yield* actions.task02.saga({ext: "ext"})

          // the path saga generator would be typed
          // uncomment to check the type err
          // typed err
          // yield* actions.task03.saga({extraField: "ext"})

          const res = yield* actions.task02.saga({extraField: "ext"})

          // the result of saga would be typed
          // uncomment to check the type err
          // expect(res.typ2).toBeUndefined();

          expect(res.typ).toBeDefined();
          expect(res.millsToDelay).toBeDefined();
          expect(res.extra).toBeDefined();

        }

      })
      .build();

    const dependencies: Dependencies = { appName: "typing" };

    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    const res1 = await basicCtn.actions.task01.dispatch({});

    expect(res1.typ).toBeDefined();
    expect(res1.millsToDelay).toBeDefined();

    // the payload of dispatched promise would be typed
    // uncomment to check the type err
    // const _res2 = await basicCtn.actions.task02.dispatch({ext: 'extPlFd'});
    const res2 = await basicCtn.actions.task02.dispatch({extraField: 'extPlFd'});

    expect(res2.typ).toBeDefined();
    // the result of dispatched promise would be typed
    // uncomment to check the type err
    // expect(res2.typ2).toBeDefined();
    expect(res2.millsToDelay).toBeDefined();
    expect(res2.extra).toBeDefined();

  })

  // let's have one cancel example for fun

  describe("cancel example suite", () => {

    const cancelStr = "Sync Cancelled!";
    const dummyObj = {data:"Success"};
    const dummyApi = ()=> new Promise((res)=>{
      setTimeout(()=>{
        res(dummyObj);
      }, 500);
    })

    const basicModel = defaultModelBuilder
      .state(() => ({
        loading: false,
        result: {} as any,
        errMsg: "",
      }))
      .reducers({
        setLoading(state, payload: boolean) {
          state.loading = payload;
        },
        setResult(state, payload: any) {
          state.result = payload;
          state.loading = false;
        },
        setErrMsg(state, msg: string) {
          state.errMsg = msg;
          state.loading = false;
        },
        // i am super lazy to create another fake action
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setCancelledFields(){}
      })
      .sagas({
        _$bgSync: function*(action) {
          const { actions } = action.context;
          try {
            yield putResolve(actions.setLoading.create(true));
            const res = yield call(dummyApi);
            yield putResolve(actions.setResult.create(res));
          } finally {
            if (yield cancelled())
              yield put(actions.setErrMsg.create(cancelStr))
          }
        }
      })
      .sagas({
        // usually, throttling is need, but for simplicity takeEvery is good enough for demo
        startComplexFetch: function*(action) {
          const {actions} = action.context;
          const bgSyncTask = yield fork(actions._$bgSync.saga, {})
          yield take(actions.setCancelledFields.type);
          yield cancel(bgSyncTask);
        }
      })
      .build();

    it ("do not cancel", async ()=> {
      jest.useFakeTimers();

      const dependencies: Dependencies = {appName: 'donot cancel'};

      const { getContainer, registerModels, gc, store } = init({
        dependencies,
        enableSaga: true,
      });

      registerModels({ basicModel });

      const basicCtn = getContainer(basicModel);

      store.dispatch({
        type: basicCtn.actions.startComplexFetch.type,
        payload: {}
      })

      jest.advanceTimersByTime(600);
      await new Promise(resolve => setImmediate(resolve));

      expect(basicCtn.getState().loading).toBe(false);
      expect(basicCtn.getState().result).toBe(dummyObj);
      expect(basicCtn.getState().errMsg).toBe("");

    })

    it ("cancelled", async ()=> {

      const dependencies: Dependencies = {appName: 'cancelled'};

      const { getContainer, registerModels, gc, store } = init({
        dependencies,
        enableSaga: true,
      });

      registerModels({ basicModel });

      const basicCtn = getContainer(basicModel);

      store.dispatch({
        type: basicCtn.actions.startComplexFetch.type,
        payload: {}
      })
      await basicCtn.actions.setCancelledFields.dispatch({});

      expect(basicCtn.getState().loading).toBe(false);
      expect(JSON.stringify(basicCtn.getState().result)).toMatch("{}");
      expect(basicCtn.getState().errMsg).toBe(cancelStr);

    })

  });

  describe("cancel thunk/observable example suite", () => {

    const cancelStr = "Sync Cancelled!";
    const dummyObj = {data:"Success"};
    const dummyApi = ()=> new Promise((res)=>{
      setTimeout(()=>{
        res(dummyObj);
      }, 500);
    })

    const basicModel = defaultModelBuilder
      .state(() => ({
        loading: false,
        result: {} as any,
        errMsg: "",
        cancelled: false,
      }))
      .reducers({
        setLoading(state, payload: boolean) {
          state.loading = payload;
        },
        setResult(state, payload: any) {
          state.result = payload;
          state.loading = false;
        },
        setErrMsg(state, msg: string) {
          state.errMsg = msg;
          state.loading = false;
        },
        // i am super lazy to create another fake action
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        startComplexFetch(){}
      })
      .effects({
        setCancelledFields: async (ctx)=>{
          const { actions } = ctx;
          await actions.setErrMsg.dispatch(cancelStr);
        }
      })
      .epics([
        ({rootAction$,actions}) => {
          return rootAction$
            .pipe(
              ofType(actions.startComplexFetch.type),
              tap(async (action)=>{
                // Oops untyped, the same as saga take typeless by default euh?
                expect(action.payload.something).toBeUndefined();
                await actions.setLoading.dispatch(true);
                return action;
              }),
              // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
              // @ts-ignore
              mergeMap(action => of(action)).pipe(
                tap(async () => {
                  const res = await dummyApi();
                  await actions.setResult.dispatch(res);
                })
              ),
              takeUntil(rootAction$.pipe(
                ofType(actions.setCancelledFields.type)
              )),
            );
        }
      ])
      .build();

    it("do not cancel",async ()=>{

      jest.useFakeTimers()

      const dependencies: Dependencies = {appName: 'cancel thunk/observable'};
      const { getContainer, registerModels, gc, store } = init({
        dependencies,
        enableSaga: true,
      });

      registerModels({ basicModel });
      const basicCtn = getContainer(basicModel);

      store.dispatch({
        type: basicCtn.actions.startComplexFetch.type,
        payload: {}
      })

      jest.advanceTimersByTime(601);
      await new Promise(resolve => setImmediate(resolve));

      expect(basicCtn.getState().loading).toBe(false);
      expect(basicCtn.getState().result).toBe(dummyObj);
      expect(basicCtn.getState().errMsg).toBe("");

    })

    it("cancelled",async ()=>{

      const dependencies: Dependencies = {appName: 'cancel thunk/observable'};
      const { getContainer, registerModels, gc, store } = init({
        dependencies,
        enableSaga: true,
      });

      registerModels({ basicModel });
      const basicCtn = getContainer(basicModel);

      store.dispatch({
        type: basicCtn.actions.startComplexFetch.type,
        payload: {}
      })
      await basicCtn.actions.setCancelledFields.dispatch({});

      expect(basicCtn.getState().loading).toBe(false);
      expect(JSON.stringify(basicCtn.getState().result)).toMatch("{}");
      expect(basicCtn.getState().errMsg).toBe(cancelStr);

    })
  })
})
