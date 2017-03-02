# ghostRiderJS

Thanks to it, you can now run scenarios in phantom with generators !

### Example
```
const co     = require('co');
const page   = require('webpage').create();
const GhostRider = require('ghost-rider');

co(function * () {
  var nicolas = new GhostRider(page, "http://endpoint.com");
  yield nicolas.ride("./scenario.json");
  phantom.exit();
}).catch(function(err) {
  console.log(err);
});
```

### Scenario format
```
{
  "settings" : {
    "screenshots_basedir" : "./screenshots",
    "screenshots_extension"  : ".png"
  },
  "alias" : {
    "gohome" : [
      { "click" : "#logo" }
    ]
  },
  "scenario" : [
    "gohome",
    {"screenshot" : "01_home"},
    {"click" : "#contact"},
    {"screenshot" : "02_contact_page"},
    "gohome",
    {"click" : "#async_load_in_iframe"},
    {
      "waitFor" : {
        "selector" : "#id_in_iframe",
        "parentFrame" : "#iframeid",
        "untilVisible" : true
      }
    },
    {"screenshot" : "03_page_with_iframe"}
  ]
}
```

### You can also wrap it with your own scripts
```
const co     = require('co');
const page   = require('webpage').create();
const GhostRider = require('ghost-rider');

class Cage extends GhostRider {
  constructor(page, address) {
    super(page, adresse);
  }

  * start_engine() {
    var languages = ["fr-fr", "en-us"];

    do {
      yield this.play("window.current_language = " + languages[0] + "; window.app.reload();");
      yield this.ride("./scenario.json");
      languages = languages.slice(1);
    } while (languages.length);

    return Promise.resolve();
  }
}

co(function * () {
  var cage = new Cage(page, "http://endpoint.com");
  yield cage.start_engine();
  phantom.exit();
}).catch(function(err) {
  console.log(err);
});
```

Enjoy !
