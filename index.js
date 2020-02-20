'use strict';

const fs         = require('fs');
const path       = require('path');

const bind       = require('bindthem');
const puppeteer  = require('puppeteer');

const forOwn     = require('mout/object/forOwn');
const sleep      = require('nyks/async/sleep');
const rmrf       = require('nyks/fs/rmrf');

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
    let current_node_version = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

    if(current_node_version < 7)
      throw 'Your node version must be at least 7 !';

    this.options = {...DEFAULT_OPTIONS, ...(options || {})};
    this.driver  = null;
    this.page    = null;
    this.is_main = (this.constructor === GhostRider.prototype.constructor);

    this.actions = [
      'click', 'type', 'select', 'screenshot', 'waitFor', 'wait', 'play'
    ];

    bind(this, this.actions);

    this.screenshots_increment = 0;
  }

  async ride(scenario) {
    this.driver = scenario;

    if(!this.driver)
      throw 'No scenario sended';

    if(this.driver.alias) {
      forOwn(this.driver.alias, (alias, name) => {
        if(this.actions.indexOf(name) > -1)
          return console.log(`${name} can't be added, this function already exists`);
        this.actions.push(name);
        this[name] = alias;
      });
    }

    let screenshots_path = path.resolve(process.cwd(), this.options.screenshots_dir);

    await rmrf(screenshots_path);

    if(!fs.existsSync(screenshots_path) && !this.options.ignore_screenshots)
      fs.mkdirSync(screenshots_path);

    let browser = await this.page_open();

    await this.readScenario(this.driver.scenario.slice(0));

    if(this.options.coverage)
      await this.write_coverage();

    browser.close();
  }

  async page_open() {
    let options = this.options.sandbox ? {} : {
      args : ['--no-sandbox', '--disable-setuid-sandbox']
    };

    if(this.options.slowMo)
      options.slowMo   = this.options.slowMo;

    if(this.options.visible)
      options.headless = false;

    let browser = await puppeteer.launch(options);

    this.page   = await browser.newPage();

    this.page.on('error', (err) => console.log('an error occured, the page might have crashed !', err));

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

    let currentTask = scenario[0];

    scenario.shift();

    let method = (typeof currentTask == 'string') ? currentTask : Object.keys(currentTask)[0];

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
    let coverage = await this.page.evaluate('window.__coverage__');

    if(coverage) {
      console.log('Writing coverage to coverage/coverage.json');
      if(!fs.existsSync('coverage/'))
        fs.mkdirSync('coverage');
      fs.writeFileSync('coverage/coverage.json', JSON.stringify(coverage, null, 2));
    } else {
      console.log('No coverage data generated');
    }
  }

  select([selector, value]) {
    console.log(`selecting value ${value} on select ${selector}`);

    return this.page.evaluate((selector, value) => {
      var input = document.querySelector(selector);
      var event = new Event('change', {bubbles: true});

      input.value = value;
      input.dispatchEvent(event);
    }, selector, value);
  }

  type([selector, value]) {
    console.log(`set ${value} for selector ${selector}`);

    return this.page.evaluate((selector_in, value_in) => {
      var input       = document.querySelector(selector_in);
      var valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      var evt         = new Event('input', {bubbles : true});

      valueSetter.call(input, value_in);
      input.dispatchEvent(evt);
    }, selector, value);
  }

  click(selector) {
    console.log(`clicked on ${selector}`);

    return this.page.click(selector);
  }

  async screenshot(screenshot_name) {
    if(this.options.ignore_screenshots)
      return console.log('Ignore screenshot step');

    await this.wait(this.options.screenshot_delay || 100);

    let screenshot_file = `${`0${this.screenshots_increment}`.substr(-2)}_${screenshot_name}${this.options.screenshots_ext}`;
    let screenshot_path = path.resolve(this.current_screenshots_dir, screenshot_file);

    console.log(`Take a screenshot in ${screenshot_path}`);

    await this.page.screenshot({path : screenshot_path});
    this.screenshots_increment++;
  }

  waitFor(args) {
    let selector  = args.selector || 'body';
    let visible   = null;

    if(args.untilInvisible)
      visible = 'hidden';

    if(!visible || args.untilVisible)
      visible = 'visible';


    console.log(`waiting for ${selector} to be ${visible}`);

    return this.page.waitForSelector(selector, {visible});
  }

  wait(time) {
    console.log(`waiting ${time / 1000}s.`);
    return sleep(time || 0);
  }

  play(script) {
    console.log(`evaluate script "${script}"`);
    return this.page.evaluate(eval(`(function() { ${script} })`));
  }

};
