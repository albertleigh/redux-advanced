import { createModelBuilder, init } from "../index";
import { put, take, takeLatest } from "redux-saga/effects";

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
          yield* actions._$customChange.saga(custemAct);
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
});
