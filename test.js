const addLogMethods = [{
  type: 'Console',
  data: {
    level: 'silly',
    colorize: true,
    name: 'console2',
    timestamp: true
  }
}]

const logger = new(require("./logger.js"))(addLogMethods);

logger.err("err");
logger.error("error");

logger.warn("warn");
logger.warning("warning");

logger.info("info");
logger.log("log");

logger.verbose("verbose");

logger.debug("debug");
logger.trace("trace");

logger.silly("silly");