"use strict";

const fs      = require('fs');
const bind    = require('bindthem');
const system  = require('system');

const sleep      = require('nyks/function/sleep');
const sprintf    = require('nyks/string/format');
const startsWith = require('mout/string/startsWith');
const ltrim      = require('mout/string/ltrim');
const forOwn     = require('mout/object/forOwn');

const DEFAULT_OPTIONS = {
  coverage : false
};

module.exports = class GhostRider {
  constructor(page, address, options) {
    this.address = address;

    this.driver = null;

    this.is_main = (this.constructor === GhostRider.prototype.constructor);

    this.options = DEFAULT_OPTIONS;
    this.parse_args();

    this.screenshots_basedir   = './';
    this.screenshots_extension = '.jpg';

    this.screenshots_dir = '';

    this.available_actions = [
      'click', 'screenshot', 'waitFor'
    ];

    bind(this, this.available_actions);

    this.page = page;
    this.page.onConsoleMessage = function(msg, lineNum, sourceId) {
      console.log(msg);
    };

  }

  parse_args() {
    system.args.forEach(arg => {
      if (startsWith(arg, '-')) {
        let option = ltrim(arg, '-').split('=');
        this.options[option[0]] = option[1] || true;
      }
    });
  }

  get current_screenshots_dir() {
    return sprintf('%s/%s', this.screenshots_basedir, this.screenshots_dir);
  }

  page_open() {
    var defered = defer();
    this.page.open(this.address, defered.resolve);
    return defered;
  }

  * waitFor(args) {
    var selector = args.selector || 'body';
    var parentFrame = args.parentFrame || false;
    var checkvisible = args.untilVisible || false;

    var found = this.page.evaluate(this.foundElement, selector, parentFrame, checkvisible);
    if(found) {
      console.log('Found ' + selector);
      return Promise.resolve();
    }
    yield sleep(300);
    yield this.waitFor(args);
  }

  foundElement(selector, parentFrame, checkvisible) {
    
    var isVisible = function(element) {

      if (element.offsetWidth === 0 || element.offsetHeight === 0) return false;

      var height = root.documentElement.clientHeight;
      var rects = element.getClientRects();
      var on_top = function(r) {
        var x = (r.left + r.right)/2, y = (r.top + r.bottom)/2;
        return element.contains( root.elementFromPoint(x, y) );
      };

      for (var i = 0, l = rects.length; i < l; i++) {
        var r = rects[i];
        var in_viewport = r.top > 0 ? r.top <= height : (r.bottom > 0 && r.bottom <= height);
        if (in_viewport && on_top(r)) return true;
      }
      return false;
    }

    var root = document;
    if(parentFrame) {
      var iframe = document.querySelector(parentFrame);
      if(!iframe)
        return;
      root = iframe.contentWindow.document;
    }

    var found = root.querySelector(selector);
    if(!found)
      return false;

    if(checkvisible)
      return isVisible(found);

    return true;
  }

  * click(selector){
     this.page.evaluate(function(selector) {
      document.querySelector(selector).click();
    }, selector);
    console.log('clicked on ' + selector);
    return Promise.resolve();
  }

  * screenshot(screenshot_name) {
    if (!fs.isDirectory(this.current_screenshots_dir))
      fs.makeDirectory(this.current_screenshots_dir);


    let screenshot_path = sprintf("%s/%s%s", this.current_screenshots_dir, screenshot_name, this.screenshots_extension);
    console.log(sprintf("Take a screenshot, save it in %s", screenshot_path))
    this.page.render(screenshot_path);
    return Promise.resolve();
  }

  * play(script) {
    this.page.evaluate(eval("(function() { " + script + " })"));
    return Promise.resolve();
  }

  * ride(scenario) {

    this.driver = scenario;
    if (!this.driver)
      return Promise.reject();

    if (this.driver.settings.screenshots_basedir)
      this.screenshots_basedir = this.driver.settings.screenshots_basedir;

    if (this.driver.settings.screenshots_extension)
      this.screenshots_extension = this.driver.settings.screenshots_extension;

    if (this.driver.alias) {
      forOwn(this.driver.alias, (alias, name) => {
        if (this.available_actions.indexOf(name) > -1)
          return console.log(name + " can't be added, this function already exists");
        this.available_actions.push(name);
        this[name] = alias;
      });
    }

    if (!fs.isDirectory(this.screenshots_basedir))
      fs.makeDirectory(this.screenshots_basedir);

    yield this.readScenario(this.driver.scenario.slice(0));

    if (this.options.coverage)
      this._write_coverage();

    return Promise.resolve();
  }

  _write_coverage() {
    if (!this.is_main)
      return; // Ghost rider has been extended, do not write coverage automatically

    this.write_coverage();
  }

  write_coverage() {
    var coverage = this.page.evaluate(function() {
      return window.__coverage__;
    });

    if (coverage) {
      console.log('Writing coverage to coverage/coverage.json');
      fs.write('coverage/coverage.json', JSON.stringify(coverage), 'w');
    } else {
      console.log('No coverage data generated');
    }
  }

  * readScenario(scenario) {

    if (!scenario.length)
      return Promise.resolve();

    var currentTask = scenario[0];
    scenario.shift();

    var method = (typeof currentTask == "string") ? currentTask : Object.keys(currentTask)[0];

    if (typeof this[method] == 'function')
      yield this[method](currentTask[method]);

    if (typeof this[method] == 'object')
      yield this.readScenario(this[method].slice(0));

    yield this.readScenario(scenario);
  }

}