
const logger = new(require("./logger.js"))(null, {level: 'debug', colorize: true, timestamp: true});

logger.err("err");
logger.error("error");

logger.warn("warn");
logger.warning("warning");

logger.info("info");
logger.log("log");

logger.alert("alert");

logger.emerg("emerg");

logger.crit("crit");