import { createModelBuilder, init, SGA } from "../index";
import { call, delay, put, take, takeLatest } from "redux-saga/effects";

interface Dependencies {
  appId: number;
}

const defaultModelBuilder = createModelBuilder()
  .dependencies<Dependencies>()
  .freeze();

describe("saga api testes", () => {
  let setNameCount = 0;
  let setAgeCount = 0;

  beforeEach(() => {
    setNameCount = 0;
    setAgeCount = 0;
  });

  it("basic cases", async () => {
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

    const dependencies: Dependencies = { appId: 1 };

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
  });

  it ('verify root registered payload', async ()=>{
    let theAct: any;
    const basicModel = defaultModelBuilder
      .sagas({
        // eslint-disable-next-line require-yield
        _$tkePayload: function* (action) {
          theAct = action;
        }
      })
      .sagas({
        $$rootEntry: function* (action) {
          const { actions } = action.context;
          yield takeLatest(actions._$tkePayload.type, actions._$tkePayload.saga);
        }
      })
      .build();

    const dependencies: Dependencies = { appId: 2 };

    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    await basicCtn.actions._$tkePayload.dispatch({innerTyp:"_$tkePayload"});

    expect(theAct['context']).toBeDefined();
    expect(theAct.payload['context']).toBeUndefined();

  })

  it ('verify dispatch response', async ()=>{
    const obj = { data: "success"};

    const dummyFetch = ()=> new Promise((res)=>{
      setTimeout(()=>{
        res(obj)
      }, 500);
    })

    const basicModel = defaultModelBuilder
        .sagas({
          fetchEffect: function* () {
            return yield call(dummyFetch);
          },
          _$privateFetchEffect: function* () {
            return yield call(dummyFetch);
          }
        })
        .build();

    const dependencies: Dependencies = { appId: 2 };

    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    let res = await basicCtn.actions.fetchEffect.dispatch({innerTyp: "_$tkePayload"});

    expect(res).toBe(obj);

    res = await basicCtn.actions._$privateFetchEffect.dispatch({innerTyp: "_$tkePayload"});

    expect(JSON.stringify(res)).toBe("{}");

  })

  it('verify result typ',async ()=>{
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
        task02:function*() {
          const millsToDelay = 219;
          yield delay(millsToDelay);
          return {
            typ: 'task01',
            millsToDelay,
          }
        },
        task03:function*(action: SGA<{
          extraField: string;
        }>) {
          const py = action.payload;
          const millsToDelay = 220;
          yield delay(millsToDelay);
          return {
            typ: 'task01',
            millsToDelay,
            extra: py.extraField

          }
        },
      })
    .build();

    const dependencies: Dependencies = { appId: 3 };

    const { getContainer, registerModels, gc } = init({
      dependencies,
      enableSaga: true,
    });

    registerModels({ basicModel });
    const basicCtn = getContainer(basicModel);

    const res1 = await basicCtn.actions.task01.dispatch({});

    expect(res1.typ).toBeDefined();
    expect(res1.millsToDelay).toBeDefined();

    const res3 = await basicCtn.actions.task03.dispatch({extraField: 'extPlFd'});

    expect(res3.typ).toBeDefined();
    expect(res3.millsToDelay).toBeDefined();
    expect(res3.extra).toBeDefined();

  })

});
