/**
 * 主入口
 * 通过require("essi")
 * */
var ESSI = require("./api");

var pkg = require(__dirname + "/package.json");
require("check-update")({
  packageName: pkg.name,
  packageVersion: pkg.version,
  isCLI: process.title == "node"
}, function (err, latestVersion, defaultMessage) {
  if (!err && pkg.version < latestVersion) {
    console.log(defaultMessage);
  }
});

function init_config(dir) {
  var pathLib = require("path");
  var fsLib = require("fs");
  var mkdirp = require("mkdirp");

  if (dir) {
    var confDir, confFile, json = pathLib.basename(__dirname) + ".json";
    if (dir.indexOf('/') == 0 || /^\w{1}:[\\/].*$/.test(dir)) {
      if (/\.json$/.test(dir)) {
        confFile = dir;
        confDir = pathLib.dirname(confFile);
      }
      else {
        confDir = dir;
        confFile = pathLib.join(confDir, json);
      }
    }
    else {
      confDir = pathLib.join(process.cwd(), dir);
      confFile = pathLib.join(confDir, json);
    }

    if (!fsLib.existsSync(confDir)) {
      mkdirp.sync(confDir);
      fsLib.chmod(confDir, 0777);
    }

    return confFile;
  }
  else {
    return null;
  }
}

exports = module.exports = function (param, dir) {
  var confFile = init_config(dir);

  return function () {
    var essiInst = new ESSI(param, confFile);

    var req, res, next;
    switch (arguments.length) {
      case 1:
        req = this.req;
        res = this.res;
        next = arguments[0];
        break;
      case 3:
        req = arguments[0];
        res = arguments[1];
        next = arguments[2];
        break;
      default:
        next = function () {
          console.log("Unknown Web Container!");
        };
    }

    try {
      if (req && res && next) {
        essiInst.handle(req, res, next);
      }
      else {
        next();
      }
    }
    catch (e) {
      console.log(e);
    }
  }
};

exports.gulp = function (param, dir) {
  var through = require("through2");

  var essiInst = new ESSI(param, init_config(dir));
  essiInst.param.traceRule = false;

  return through.obj(function (file, enc, cb) {
    var self = this;

    if (file.isNull()) {
      self.emit("error", "isNull");
      cb(null, file);
      return;
    }

    if (file.isStream()) {
      self.emit("error", "Streaming not supported");
      cb(null, file);
      return;
    }

    essiInst.compile(
      file.path,
      file.contents,
      true,
      function (err, buff) {
        var str = buff.toString();
        if (!param.strictPage || str.match(/<html[^>]*?>([\s\S]*?)<\/html>/gi)) {
          file.contents = buff;
          self.push(file);
          cb();
        }
        else {
          return cb();
        }
      }
    );
  });
};