"use strict";

const fs        = require('fs');
const path      = require('path');
const bind      = require('bindthem');
const puppeteer = require('puppeteer');

const sleep      = require('nyks/async/sleep');
const rmrf       = require('nyks/fs/rmrf');
const sprintf    = require('nyks/string/format');
const forOwn     = require('mout/object/forOwn');
const merge      = require('mout/object/merge');

const DEFAULT_OPTIONS = {
  coverage           : false,
  width              : 1024,
  height             : 768,
  screenshots_dir    : './screenshots',
  screenshots_ext    : '.jpg',
  address            : 'http://127.0.0.1:8000', // default express url
  ignore_screenshots : false
};

module.exports = class GhostRider {

  constructor(options) {

    var current_node_version = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

    if(current_node_version < 7)
      throw "Your node version must be at least 7 !";

    this.options = merge(DEFAULT_OPTIONS, options);

    this.driver = null;
    this.page   = null;

    this.is_main = (this.constructor === GhostRider.prototype.constructor);

    this.available_actions = [
      'click', 'screenshot', 'waitFor', 'wait', 'play'
    ];

    bind(this, this.available_actions);

    this.screenshots_increment = 0;
  }

  async ride(scenario) {

    this.driver = scenario;
    if(!this.driver)
      throw "No scenario sended";

    if(this.driver.alias) {
      forOwn(this.driver.alias, (alias, name) => {
        if(this.available_actions.indexOf(name) > -1)
          return console.log(name + " can't be added, this function already exists");
        this.available_actions.push(name);
        this[name] = alias;
      });
    }

    let screenshots_path = path.resolve(process.cwd(), this.options.screenshots_dir);

    await rmrf(screenshots_path);

    if(!fs.existsSync(screenshots_path) && !this.options.ignore_screenshots)
      fs.mkdirSync(screenshots_path);

    var browser = await this.page_open();
    await this.readScenario(this.driver.scenario.slice(0));

    if(this.options.coverage)
      await this.write_coverage();

    browser.close();
  }

  async page_open() {

    var options = {
      args : ['--no-sandbox', '--disable-setuid-sandbox']
    };

    if(this.options.slowMo)
      options.slowMo   = this.options.slowMo;
    if(this.options.visible)
      options.headless = false;

    var browser = await puppeteer.launch(options);
    this.page   = await browser.newPage();
    this.page.on('error', function(err) {
      console.log('an error occured, the page might have crashed !', err);
    });
    this.page.setViewport({
      width  : this.options.width,
      height : this.options.height
    });

    await this.page.goto(this.options.address);

    return browser;
  }

  async readScenario(scenario) {

    if(!scenario.length)
      return;

    var currentTask = scenario[0];
    scenario.shift();

    var method = (typeof currentTask == "string") ? currentTask : Object.keys(currentTask)[0];

    if(typeof this[method] == 'function')
      await this[method](currentTask[method]);

    if(typeof this[method] == 'object')
      await this.readScenario(this[method].slice(0));

    await this.readScenario(scenario);
  }

  get current_screenshots_dir() {
    return path.resolve(process.cwd(), this.options.screenshots_dir);
  }

  async write_coverage() {
    var coverage = await this.page.evaluate("window.__coverage__");

    if(coverage) {
      console.log('Writing coverage to coverage/coverage.json');
      if(!fs.existsSync('coverage/'))
        fs.mkdirSync('coverage');
      fs.writeFileSync('coverage/coverage.json', JSON.stringify(coverage, null, 2));
    } else {
      console.log('No coverage data generated');
    }
  }

  async click(selector) {
    await this.page.click(selector);
    console.log('clicked on ' + selector);
  }

  async screenshot(screenshot_name) {
    if(this.options.ignore_screenshots)
      return console.log('Ignore screenshot step');

    await this.wait(this.options.screenshot_delay || 100);

    let screenshot_file = sprintf('%s_%s%s', ('0' + this.screenshots_increment).substr(-2), screenshot_name, this.options.screenshots_ext);
    let screenshot_path = path.resolve(this.current_screenshots_dir, screenshot_file);
    console.log(sprintf("Take a screenshot in %s", screenshot_path));
    await this.page.screenshot({path : screenshot_path});
    this.screenshots_increment++;
  }

  async waitFor(args) {
    var selector  = args.selector       || 'body';
    var visible   = args.untilVisible   || false;
    var invisible = args.untilInvisible || false;

    console.log('waitfor', {selector, visible, invisible});

    if(invisible) {
      let frame = this.page.mainFrame();
      await frame.waitForFunction("$('" + selector + "').length == 0");
      return;
    }

    await this.page.waitForSelector(selector, {visible});
  }

  async wait(time) {
    await sleep(time || 0);
  }

  async play(script) {
    await this.page.evaluate(eval("(function() { " + script + " })"));
  }

};
