const os = require('os'),
  winston = require('winston'),
  path = require('path'),
  PROJECT_ROOT = path.join(__dirname, '../..'),
  _ = require('lodash'),
  util = require('util'),
  localStorage = require('continuation-local-storage'),
  mdx = localStorage.createNamespace('mdx');

class Logger {

  constructor() {
    this.logger = new winston.Logger();
    this._log = this._log.bind(this);


    this.warn = this.warn.bind(this);
    this.warning = this.warn.bind(this);

    this.error = this.error.bind(this);
    this.err = this.error.bind(this);


    this.trace = this.debug.bind(this);
    this.debug = this.debug.bind(this);

    this.log = this.info.bind(this);
    this.info = this.info.bind(this);

    this.logger.add(winston.transports.Console, {
      level: 'debug',
      colorize: true,
      timestamp: true,
      exitOnError: false
    });
  }

  _log() {
    var req = undefined;
    if (mdx) {
      var req = mdx.get("req");
    }
    if (req) {
      this.logger.log.apply(this.logger, mkLogArgs(req, 2, arguments))
    } else {
      this.logger.log.apply(this.logger, mkLogArgs(undefined, 2, arguments))
    }
  }

  info() {
    this._log("info", arguments);
  };

  warn() {
    this._log("warn", arguments);
  }

  error() {
    this._log("error", arguments);
  }

  debug() {
    this._log("debug", arguments);
  }

  setupLogger(req, res, next) {

    mdx.run(function() {
      mdx.set("req", req);
      next();
    });
  }
}

function mkLogArgs(req, depth, args) {
  var user_id = "-";
  var event_id = "-";
  if (req && req.acting_user) {
    user_id = req.acting_user.user_id;
  }
  if (req && req._event && req._event.id) {
    event_id = req._event.id;
  }
  var level = args[0];
  args = args[1];
  args = [event_id, user_id].concat(Array.prototype.slice.call(args));
  var stackInfo = getStackInfo(depth);

  if (stackInfo) {
    // get file path relative to project root
    var calleeStr = '[' + stackInfo.relativePath + ':' + stackInfo.line + ']';

    if (typeof(args[0]) === 'string') {
      args[0] = calleeStr + ' ' + args[0];
    } else {
      args.unshift(calleeStr);
    }
  }

  args.unshift(level);
  return args;
}

/**
 * Parses and returns info about the call stack at the given index.
 */
function getStackInfo(stackIndex) {
  // get call stack, and analyze it
  // get all file, method, and line numbers
  var stacklist = (new Error()).stack.split('\n').slice(3)

  // stack trace format:
  // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
  var stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
  var stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi

  var s = stacklist[stackIndex] || stacklist[0]
  var sp = stackReg.exec(s) || stackReg2.exec(s)

  if (sp && sp.length === 5) {
    return {
      method: sp[1],
      relativePath: path.relative(PROJECT_ROOT, sp[2]),
      line: sp[3],
      pos: sp[4],
      file: path.basename(sp[2]),
      stack: stacklist.join('\n')
    }
  }
}

module.exports.getMdx = function() {
  return mdx;
}

module.exports = new Logger();
