const Path = require("path");
const Util = require("util");
const Syslogger = require("ain2");
const chalk = require("chalk");

const MAX_DEPTH = 2;
/* const MAX_DEPTH = 10; */

const syslog_severity_map = {
  emerg: 0,
  alert: 1,
  crit: 2,
  err: 3,
  error: 3,
  warn: 4,
  notice: 5,
  info: 6,
  debug: 7
};

const color_map = {
  0: chalk.red.bold,
  1: chalk.cyan,
  2: chalk.red.underline,
  3: chalk.red,
  4: chalk.yellow,
  5: chalk.magenta,
  6: chalk.green,
  7: chalk.blue
}

// we need to filter of type string and number otherwise
// util.inspect will convert it to be quoted. i.e: 42 -> '42', hello -> 'hello'
// it's weird
const parseCircular = (obj, depth = MAX_DEPTH) => typeof obj === 'string' || typeof obj === 'number' ? obj : Util.inspect(obj, { depth: MAX_DEPTH, breakLength: Infinity })
  .split("\n")
  .map(line => line.trim())
  .join(" ");

class Logger {
  constructor(_syslog, _console, _global) {
    this._bind = this._bind.bind(this);
    this._bind();

    this.PROJECT_ROOT = process.cwd();
    if (_syslog) {
      this._enableSyslog(_syslog);
    }
    if (_console) {
      this.hasConsole = true;
      this.consoleSettings = typeof _console === 'object' ? _console : { level: 'debug', colorize: true, timestamp: true };
    }
    if (_global) {
      this.globalSettings = _global;
      if (_global.root) {
        this.PROJECT_ROOT = Path.resolve(_global.root);
      }
    }
  }

  _bind() {
    //funcs
    this._send = this._send.bind(this);
    this._enableSyslog = this._enableSyslog.bind(this);
    this._getStackInfo = this._getStackInfo.bind(this);
    this._makeLog = this._makeLog.bind(this);
    this._handleErr = this._handleErr.bind(this);
    //base logs
    this.emerg = this.emerg.bind(this);
    this.alert = this.alert.bind(this);
    this.crit = this.crit.bind(this);
    this.error = this.error.bind(this);
    this.warn = this.warn.bind(this);
    this.notice = this.notice.bind(this);
    this.info = this.info.bind(this);
    this.debug = this.debug.bind(this);
    //aliases
    this.emergency = this.emerg;
    this.err = this.error;
    this.warning = this.warn;
    this.log = this.info;
    this.critical = this.crit;
  }

  _handleErr(err) {
    /* process.stdout.write(err); */
    if (err) {
      console.error(`BeboNodeCommons::Logger:_handleErr -- `, err);
    }
  }

  _enableSyslog(config) {
    if (typeof config !== 'object') {
      process.stdout.write(this._makeLog('error', `BeboNodeCommons::Logger:_enableSyslog -- could not instantiate syslog, invalid config type. Expected 'object', got ${typeof config}.`));
      return;
    }
    const tag = config.tag || config.app_name || config.appName || 'Logger';
    //inconsistent ugh
    const facility = config.facility || 'local0';
    const hostname = config.hostname || config.host || require("os").hostname();
    /* const port = config.port || Config.LOG_SYSLOG.port; */
    /* const address = config.address || Config.LOG_SYSLOG.address; */
    const path = config.path || "/dev/log";
    const level = config.level || "debug";

    this.syslogger = Syslogger.getInstance();
    this.syslogger.set({ tag, facility, path, hostname: '       ' });
    this.syslogger.setTransport('unix_dgram');
    this.hasSyslog = true;
    this.syslogSettings = {
      level,
      hostname
    };
  }

  _getStackInfo() {
    const stackIndex = this.globalSettings && 'depth' in this.globalSettings ? this.globalSettings.depth : 2;
    // get call stack, and analyze it
    // get all file, method, and line numbers
    const stacklist = (new Error()).stack.split('\n').slice(3)

    // stack trace format:
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
    const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
    const stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi

    const s = stacklist[stackIndex] || stacklist[0]
    const sp = stackReg.exec(s) || stackReg2.exec(s)

    if (sp && sp.length === 5) {
      return {
        method: sp[1],
        relativePath: Path.relative(this.PROJECT_ROOT, sp[2]),
        line: sp[3],
        pos: sp[4],
        file: Path.basename(sp[2]),
        stack: stacklist.join('\n')
      }
    }
  }

  _makeLog(level, str, syslog = false) {
    const rn = new Date();
    const severity = syslog_severity_map[level];
    const chalkFn = color_map[severity];
    const stackInfo = this._getStackInfo();

    let msg = '';

    if (this.consoleSettings && this.consoleSettings.timestamp === true && !syslog) {
      //auto-added, at least on my local when I test
      msg += rn.toISOString() + ' -';
    }

    msg += ' ';

    if (this.consoleSettings && this.consoleSettings.colorize === true && !syslog) {
      msg += chalkFn(level);
    } else {
      msg += level;
    }

    msg += ' ';
    msg += `[${stackInfo.relativePath}:${stackInfo.line}:${stackInfo.pos}] `;
    msg += str;
    msg += '\n';

    return msg;
  }

  _send(level, args) {
    const arr = Object.keys(args).map(i => args[i]);
    const str = arr.map(arg => parseCircular(arg)).join(" ");

    const severity = syslog_severity_map[level];

    if (this.hasSyslog) {
      const setLevel = this.syslogSettings.level && syslog_severity_map[this.syslogSettings.level] !== undefined ? syslog_severity_map[this.syslogSettings.level] : 7;
      //default to debug, because more logs == better :D
      if (severity <= setLevel) {
        this.syslogger.send(this._makeLog(level, str, true), severity, this._handleErr);
      }
    }

    if (this.hasConsole) {
      const setLevel = this.consoleSettings.level && syslog_severity_map[this.consoleSettings.level] !== undefined ? syslog_severity_map[this.consoleSettings.level] : 7;
      //default to debug, because more logs == better :D
      if (severity <= setLevel) {
        process.stdout.write(this._makeLog(level, str, false), this._handleErr);
      }
    }
  }

  emerg() {
    this._send('emerg', arguments);
  }
  alert() {
    this._send('alert', arguments);
  }
  crit() {
    this._send('crit', arguments);
  }
  error() {
    this._send('error', arguments);
  }
  warn() {
    this._send('warn', arguments);
  }
  notice() {
    this._send('notice', arguments);
  }
  info() {
    this._send('info', arguments);
  }
  debug() {
    this._send('debug', arguments);
  }
}

module.exports = Logger;