import { createModelBuilder, init, SGA } from "../index";
import { call, delay, put, take, takeLatest } from "redux-saga/effects";

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

  // unregistered example

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

          yield* actions.task02.saga({extraField: "ext"})
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
})
