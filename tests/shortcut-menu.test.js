// Desktop geometry cases cover browser decoration, taskbars, and secondary displays.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shortcutMenuBounds} from '../extension/shortcut-menu-layout.js';
test('menu width follows content plus frame and right edge respects the usable screen area',()=>{
  const bounds=shortcutMenuBounds({contentWidth:301.5,contentHeight:510.2,frameWidth:16,frameHeight:38,availLeft:0,availTop:24,availWidth:1880,availHeight:1016});
  assert.equal(bounds.width,318);assert.equal(bounds.height,549);assert.equal(bounds.left+bounds.width,1880);
  assert.ok(bounds.top>=24);assert.ok(bounds.top+bounds.height<=1040);
});
test('menu placement supports displays left of and above the primary screen',()=>{
  for(const [availLeft,availTop] of [[-1920,0],[0,-1080],[-2560,-1440]]) {
    const bounds=shortcutMenuBounds({contentWidth:300,contentHeight:520,availLeft,availTop,availWidth:1920,availHeight:1040});
    assert.equal(bounds.left+bounds.width,availLeft+1920);assert.ok(bounds.top>=availTop);assert.ok(bounds.top+bounds.height<=availTop+1040);
  }
});
test('oversized content stays within the usable display rather than positioning controls offscreen',()=>{
  const bounds=shortcutMenuBounds({contentWidth:400,contentHeight:600,frameWidth:16,frameHeight:40,availLeft:-320,availTop:30,availWidth:320,availHeight:480});
  assert.deepEqual(bounds,{width:320,height:480,left:-320,top:30});
});
