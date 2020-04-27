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
