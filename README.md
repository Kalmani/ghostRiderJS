# ghostRiderJS

Scenario runner for Puppeteer (async/await model)

### Methods
```
{"click" : "#id"}
{"screenshot" : "screenshot_name"}
{"waitFor" : {selector, parentFrame, untilVisible}}
{"wait" : 2500}
{"play" : "alert('this script will be played in your webpage');"}
[...]
```

### Example
```
const GhostRider = require('ghost-rider');

let report = true;
let screenshots_dir = './screenshots';

const nicolas = new GhostRider({
  width  : PAGE_WIDTH,
  height : PAGE_HEIGHT,
  ignore_screenshots : !report,
  coverage : report,
  screenshots_dir : screenshots_dir,
  screenshots_ext : '.png',
  screenshot_delay : 250,

  slowMo  : 250,
  visible : true // only on windows!
});
await nicolas.ride("./scenario.json");
```

### Scenario format
```
{
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

Enjoy !
