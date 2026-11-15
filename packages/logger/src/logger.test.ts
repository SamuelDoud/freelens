import { registerFeature } from "@freelensapp/feature-core";
import { getFeature } from "@freelensapp/feature-core/src/feature";
import { createContainer, getInjectable } from "@ogre-tools/injectable";
import { describe, expect, it, vi } from "vitest";
import TransportStream from "winston-transport";
import { loggerFeature } from "./feature";
import {
  logDebugInjectionToken,
  logErrorInjectionToken,
  loggerInjectable,
  logInfoInjectionToken,
  logSillyInjectionToken,
  logWarningInjectionToken,
} from "./logger.injectable";
import { prefixedLoggerInjectable } from "./prefixed-logger.injectable";
import { loggerTransportInjectionToken } from "./transports";
import { winstonLoggerInjectable } from "./winston-logger.injectable";

describe("logger", () => {
  [
    { scenario: "debug" as const, injectionToken: logDebugInjectionToken },
    { scenario: "info" as const, injectionToken: logInfoInjectionToken },
    { scenario: "warn" as const, injectionToken: logWarningInjectionToken },
    { scenario: "error" as const, injectionToken: logErrorInjectionToken },
    { scenario: "silly" as const, injectionToken: logSillyInjectionToken },
  ].forEach(({ scenario, injectionToken }) => {
    it(`given not inside a Feature, when logging "${scenario}", does so without a prefix`, () => {
      const di = createContainer("irrelevant");

      registerFeature(di, loggerFeature);

      const winstonLoggerStub = { [scenario]: vi.fn(), isLevelEnabled: () => true } as any;

      di.override(winstonLoggerInjectable, () => winstonLoggerStub);

      const logScenario = di.inject(injectionToken);

      logScenario("some-message", "some-data");

      expect(winstonLoggerStub[scenario]).toHaveBeenCalledWith("some-message", "some-data");
    });

    it(`given not inside a Feature, when logging "${scenario}" using legacy logger, does so without a prefix`, () => {
      const di = createContainer("irrelevant");

      registerFeature(di, loggerFeature);

      const winstonLoggerStub = { [scenario]: vi.fn(), isLevelEnabled: () => true } as any;

      di.override(winstonLoggerInjectable, () => winstonLoggerStub);

      const logger = di.inject(loggerInjectable);

      logger[scenario]("some-message", "some-data");

      expect(winstonLoggerStub[scenario]).toHaveBeenCalledWith("some-message", "some-data");
    });

    it(`given not inside a Feature, when logging "${scenario}" using legacy prefixed logger, does so without a feature prefix`, () => {
      const di = createContainer("irrelevant");

      registerFeature(di, loggerFeature);

      const winstonLoggerStub = { [scenario]: vi.fn(), isLevelEnabled: () => true } as any;

      di.override(winstonLoggerInjectable, () => winstonLoggerStub);

      const logger = di.inject(prefixedLoggerInjectable, "A-PREFIX");

      logger[scenario]("some-message", "some-data");

      expect(winstonLoggerStub[scenario]).toHaveBeenCalledWith("[A-PREFIX]: some-message", "some-data");
    });

    it(`given inside a Feature, when logging "${scenario}", does so with Feature's id as prefix without trailing '-feature' to avoid redundancy`, () => {
      const di = createContainer("irrelevant");

      const logScenarioInFeature = getInjectable({
        id: "some-functionality",
        instantiate: (di) => di.inject(injectionToken),
      });

      const someFeature = getFeature({
        id: "some-feature",

        register: (di) => {
          di.register(logScenarioInFeature);
        },

        dependencies: [loggerFeature],
      });

      registerFeature(di, someFeature);

      const winstonLoggerStub = { [scenario]: vi.fn(), isLevelEnabled: () => true } as any;

      di.override(winstonLoggerInjectable, () => winstonLoggerStub);

      const logScenario = di.inject(logScenarioInFeature);

      logScenario("some-message", "some-data");

      expect(winstonLoggerStub[scenario]).toHaveBeenCalledWith("[SOME]: some-message", "some-data");
    });
  });

  it("given a single transport, when logging, does not throw, and does call the transport", () => {
    const di = createContainer("irrelevant");
    const log = vi.fn().mockImplementation((data, next) => next());

    registerFeature(di, loggerFeature);

    di.register(
      getInjectable({
        id: "some-transport",
        instantiate: () => new TransportStream({ log }),
        injectionToken: loggerTransportInjectionToken,
      }),
    );

    const logger = di.inject(loggerInjectable);

    logger.info("some-message", "some-data");

    expect(log).toHaveBeenCalled();
  });

  describe("given a real winston logger", () => {
    const setUp = (transportLevel: string | undefined) => {
      const di = createContainer("irrelevant");
      const log = vi.fn().mockImplementation((data, next) => next());

      registerFeature(di, loggerFeature);

      di.register(
        getInjectable({
          id: "some-transport",
          instantiate: () => new TransportStream({ log, level: transportLevel }),
          injectionToken: loggerTransportInjectionToken,
        }),
      );

      return { logger: di.inject(loggerInjectable), log };
    };

    it("delivers a level the transport accepts although the logger level is lower, with the formatted message", () => {
      const { logger, log } = setUp("debug");

      logger.debug("some-message", { a: 1 });

      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0][Symbol.for("message")]).toMatch(/^debug: some-message \{"a":1\}$/);
    });

    it("does not format or deliver a level no transport accepts", () => {
      const { logger, log } = setUp("debug");
      const toJSON = vi.fn(() => ({}));

      logger.silly("some-message", { toJSON });

      expect(toJSON).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    });

    it("uses the logger level for a transport without a level", () => {
      const { logger, log } = setUp(undefined);
      const toJSON = vi.fn(() => ({}));

      logger.debug("some-message", { toJSON });
      logger.info("some-message");

      expect(toJSON).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
    });
  });
});
