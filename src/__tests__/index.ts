import { createModelBuilder, init } from "../index";
import { empty, timer } from "rxjs";
import { filter, mergeMapTo, take, tap } from "rxjs/operators";

interface Dependencies {
  appId: number;
}

const defaultModelBuilder = createModelBuilder()
  .dependencies<Dependencies>()
  .freeze();
describe ("root index", ()=>{

  let setAge2Count = 0;
  let setAge2Count2 = 0;

  beforeEach(()=>{
    setAge2Count = 0;
    setAge2Count2 = 0;
  })

  it ("one shot", async ()=>{
    const testModelBuilder = defaultModelBuilder
      .state(() => ({
        name: "",
        age: 0,
      }))
      .selectors({
        rootAction$: ({ rootAction$ }) => rootAction$,
      })
      .selectors({
        _: {
          name: ({ getState }) => getState().name,
        },
        summary: ({ getState }) => `${getState().name} - ${getState().age}`,
      })
      .selectors((createSelector) => ({
        _: {
          age: createSelector(
            ({ getState }) => getState().age,
            (age) => age
          ),
        },
        fullSummary: createSelector(
          ({ getters }) => getters.summary,
          (summary, { dependencies }) => `${dependencies.appId} - ${summary}`
        ),
        summary2: createSelector(
          [({ getState }) => getState().name, ({ getState }) => getState().age],
          ([name, age]) => `${name} - ${age}`
        ),
        getName: createSelector(({ getState }) => () => getState().name),
      }))
      .selectors({
        _: {
          $: {
            summary: ({ getters }) => `${getters._.name} - ${getters._.age}`,
          },
        },
      })
      .reducers({
        _: {
          setName1(state, payload: string) {
            state.name = payload;
          },
          nested: {
            setName2(state, payload: string) {
              state.name = payload;
            },
          },
        },
        setName(state, payload: string) {
          state.name = payload;
        },
        setAge(state, payload: number) {
          state.age = payload;
        },
      })
      .effects({
        _: {
          setAge1: async ({ actions }, payload: number) => {
            await actions.setAge.dispatch(payload);
          },
        },
        $: {
          setAge2: async ({ actions }, payload: number) => {
            await actions.setAge.dispatch(payload);
          },
        },
        setName: async (context, payload: string) => {
          return payload;
        },
        innerThrow: async () => {
          throw new Error();
        },
        overrideSetInfo: async ({ actions }) => {
          await actions.setName.dispatch("haha");
        },
      })
      .effects({
        setNameAsync: async ({ actions, getState }, payload: string) => {
          await timer(50).toPromise();
          getState();
          await actions.setName.dispatch(payload);
        },
        setAgeAsync: async ({ getContainer }, payload: number) => {
          await timer(50).toPromise();
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          await getContainer(staticModel).actions.setAge.dispatch(payload);
          return "" + payload;
        },
        outerThrow: async ({ actions }) => {
          await actions.innerThrow.dispatch({});
        },
      })
      .selectors((createSelector) => ({
        setName: createSelector(({ actions }) => (name: string) => {
          actions.setName.dispatch(name);
        }),
      }))
      .overrideEffects((base) => ({
        overrideSetInfo: async (context) => {
          await base.overrideSetInfo(context, {});
          await context.actions.setAge.dispatch(666);
        },
      }))
      .epics({
        "@@": {
          countSetAge2: ({ rootAction$, actions }) =>
            rootAction$.ofType(actions.$.setAge2.type).pipe(
              tap(() => (setAge2Count += 1)),
              mergeMapTo(empty())
            ),
        },
      })
      .epics([
        ({ rootAction$, actions }) =>
          rootAction$.ofType(actions.$.setAge2.type).pipe(
            tap(() => (setAge2Count2 += 1)),
            mergeMapTo(empty())
          ),
        ({ rootAction$, actions }) =>
          rootAction$.ofType(actions.$.setAge2.type).pipe(
            tap(() => (setAge2Count2 += 2)),
            mergeMapTo(empty())
          ),
      ])
      .freeze();

    const staticModel = testModelBuilder
      .overrideState(() => ({
        name: "nyan",
      }))
      .build();

    const dynamicModel = testModelBuilder
      .args(({ required }) => ({
        name: required("fake"),
        aaa: 123,
        bbb: "123",
        ccc: {
          foo: "foo",
          bar: 666,
        },
      }))
      .extend(
        defaultModelBuilder
          .args(({ required }) => ({
            a: 1,
            b: 2,
            z: required({ foo: 1 }),
          }))
          .build(),
        "foo"
      )
      .extend(
        defaultModelBuilder
          .args(() => ({
            a: 1,
            b: 2,
            z: "z",
          }))
          .build(),
        "bar"
      )
      .overrideState(() => ({ args }) => ({
        name: args.name,
      }))
      .selectors({
        staticSummary: ({ getContainer }) =>
          getContainer(staticModel).getters.summary,
      })
      .build();

    const dynamicModel2 = testModelBuilder.build();

    const autoRegisteredDynamicModel = testModelBuilder
      .options({
        autoRegister: true,
      })
      .build();

    const appDependencies: Dependencies = { appId: 233 };

    let unhandledEffectErrorCount = 0;
    const { getContainer: storeGetContainer, registerModels, gc } = init({
      dependencies: appDependencies,
      // enableSaga: true,
      onUnhandledEffectError: () => {
        unhandledEffectErrorCount += 1;
      },
    });
    registerModels({
      staticModel,
      dynamicModels: [dynamicModel, dynamicModel2],
      autoRegisteredDynamicModel: [autoRegisteredDynamicModel],
    });

    const staticModelContainer = storeGetContainer(staticModel);
    expect(staticModelContainer.baseNamespace).toBe("staticModel");
    expect(staticModelContainer.key).toBe(undefined);
    expect(staticModelContainer.modelIndex).toBe(undefined);

    expect(storeGetContainer("staticModel")).toBe(staticModelContainer);

    let setAge233Dispatched = false;
    staticModelContainer.getters.rootAction$
      .pipe(
        filter(
          (action) =>
            staticModelContainer.actions.setAge.is(action) &&
            action.payload === 233
        ),
        take(1),
        tap(() => {
          setAge233Dispatched = true;
        })
      )
      .toPromise();

    expect(staticModelContainer.isRegistered).toBe(true);
    expect(staticModelContainer.canRegister).toBe(false);

    gc();

    expect(staticModelContainer.isRegistered).toBe(true);
    expect(staticModelContainer.canRegister).toBe(false);

    expect(staticModelContainer.getState().name).toBe("nyan");
    expect(staticModelContainer.getters.fullSummary).toBe("233 - nyan - 0");

    staticModelContainer.actions.setAge.dispatch(998);
    expect(staticModelContainer.getState().age).toBe(998);

    const staticModelSetNamePromise = staticModelContainer.actions.setNameAsync.dispatch(
      "meow"
    );
    expect(staticModelContainer.getState().name).toBe("nyan");
    const staticModelSetNameResult = await staticModelSetNamePromise;
    expect(staticModelSetNameResult).toBe(undefined);
    expect(staticModelContainer.getState().name).toBe("meow");

    expect(staticModelContainer.getters.getName()).toBe("meow");
    expect(staticModelContainer.getters.getName).toBe(
      staticModelContainer.getters.getName
    );

    staticModelContainer.getters.setName("haha");
    expect(staticModelContainer.getState().name).toBe("haha");

    expect(setAge233Dispatched).toBe(false);
    const staticModelSetAgePromise = staticModelContainer.actions.setAgeAsync.dispatch(
      233
    );
    expect(staticModelContainer.getState().age).toBe(998);
    const staticModelSetAgeResult = await staticModelSetAgePromise;
    expect(staticModelSetAgeResult).toBe("233");
    expect(staticModelContainer.getState().age).toBe(233);
    expect(setAge233Dispatched).toBe(true);

    await staticModelContainer.actions._.setName1.dispatch("_1");
    expect(staticModelContainer.getState().name).toBe("_1");
    await staticModelContainer.actions._.nested.setName2.dispatch("_2");
    expect(staticModelContainer.getState().name).toBe("_2");
    await staticModelContainer.actions._.setAge1.dispatch(1);
    expect(staticModelContainer.getState().age).toBe(1);

    expect(setAge2Count).toBe(0);
    expect(setAge2Count2).toBe(0);
    await staticModelContainer.actions.$.setAge2.dispatch(2);
    expect(setAge2Count).toBe(1);
    expect(setAge2Count2).toBe(3);
    await staticModelContainer.actions.$.setAge2.dispatch(22);
    expect(setAge2Count).toBe(2);
    expect(setAge2Count2).toBe(6);

    await staticModelContainer.actions.overrideSetInfo.dispatch({});
    expect(staticModelContainer.getState().name).toBe("haha");
    expect(staticModelContainer.getState().age).toBe(666);

    expect(staticModelContainer.getters._.name).toBe("haha");
    expect(staticModelContainer.getters._.age).toBe(666);
    expect(staticModelContainer.getters._.$.summary).toBe("haha - 666");

    staticModelContainer.actions.outerThrow.dispatch({}).then(
      () => undefined,
      () => undefined
    );
    await timer(10).toPromise();
    expect(unhandledEffectErrorCount).toBe(0);

    // staticModelContainer.actions.outerThrow.dispatch({}).then(() => undefined);
    // await timer(10).toPromise();
    // expect(unhandledEffectErrorCount).toBe(1);

    // const dynamicModelContainer = storeGetContainer(dynamicModel);
    // expect(dynamicModelContainer.isRegistered).toBe(false);
    // expect(dynamicModelContainer.namespace).toBe("dynamicModels");

    const dynamicModel1Container = storeGetContainer(dynamicModel, "1");
    expect(storeGetContainer("dynamicModels", "1", 0)).toBe(
      dynamicModel1Container
    );

    expect(dynamicModel1Container.isRegistered).toBe(false);
    expect(dynamicModel1Container.baseNamespace).toBe("dynamicModels");
    expect(dynamicModel1Container.key).toBe("1");
    expect(dynamicModel1Container.modelIndex).toBe(0);

    expect(dynamicModel1Container.getState().name).toBe("fake");

    dynamicModel1Container.register({
      name: "hahaha",
      foo: {
        z: { foo: 233 },
      },
    });
    expect(dynamicModel1Container.isRegistered).toBe(true);
    expect(dynamicModel1Container.getters.summary).toBe("hahaha - 0");
    expect(dynamicModel1Container.getters.summary2).toBe("hahaha - 0");
    expect(dynamicModel1Container.getters.staticSummary).toBe("haha - 666");

    const dynamicModel2Container = storeGetContainer(dynamicModel, "2");
    expect(dynamicModel2Container.isRegistered).toBe(false);
    expect(dynamicModel2Container.baseNamespace).toBe("dynamicModels");
    expect(dynamicModel2Container.key).toBe("2");
    expect(dynamicModel2Container.modelIndex).toBe(0);

    expect(storeGetContainer("dynamicModels", "2", 0)).toBe(
      dynamicModel2Container
    );

    dynamicModel2Container.register({
      name: "zzzzzz",
      foo: {
        z: { foo: 998 },
      },
    });
    expect(dynamicModel2Container.isRegistered).toBe(true);
    expect(dynamicModel2Container.getters.summary).toBe("zzzzzz - 0");
    expect(dynamicModel2Container.getters.summary2).toBe("zzzzzz - 0");

    const dynamicModel2SetNamePromise = dynamicModel2Container.actions.setNameAsync.dispatch(
      "Orz"
    );
    dynamicModel2Container.unregister();
    expect(dynamicModel2Container.isRegistered).toBe(false);

    let dynamicModel2SetNamePromiseResolved = false;
    (async () => {
      await dynamicModel2SetNamePromise;
      dynamicModel2SetNamePromiseResolved = true;
    })();
    await timer(60).toPromise();
    expect(dynamicModel2SetNamePromiseResolved).toBe(false);
    expect(dynamicModel2Container.getState().name).toBe("fake"); // setName is not applied after unregister

    expect(storeGetContainer("dynamicModels", "3", 1).modelIndex).toBe(1);

    const autoRegisteredDynamicContainer = storeGetContainer(
      autoRegisteredDynamicModel,
      "O_O"
    );
    expect(autoRegisteredDynamicContainer.isRegistered).toBe(false);
    expect(autoRegisteredDynamicContainer.getState().name).toBe("");

    expect(autoRegisteredDynamicContainer.isRegistered).toBe(false);
    expect(autoRegisteredDynamicContainer.getters.summary).toBe(" - 0");

    expect(autoRegisteredDynamicContainer.isRegistered).toBe(false);
    autoRegisteredDynamicContainer.actions.setName.dispatch("^_^");

    expect(autoRegisteredDynamicContainer.isRegistered).toBe(true);
    expect(autoRegisteredDynamicContainer.getState().name).toBe("^_^");

    gc((container) => container.baseNamespace === "autoRegisteredDynamicModel");
    expect(autoRegisteredDynamicContainer.isRegistered).toBe(false);
    expect(staticModelContainer.isRegistered).toBe(true);
  })
});
