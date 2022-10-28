// mills a spiral starting at 0/0/${z}, which needs to be the current position
function millSpiral(diam, ccw, stepWidth, g, xyFeed) {
  function f(x) { return Number(x).toFixed(6).replace(/\.?0+$/, '') }
  const d = stepWidth / 4

  var step = 0
  var pCurr = { x: 0, y: 0 }
  var pTarget = { x: 0, y: 0 }
  // target radius
  var rTarget = 0
  g(`; diam=${diam} stepWidth=${stepWidth}`)
  var state = 0
  var remainingClosingCount = 5
  while (rTarget < diam || remainingClosingCount) {
    step++
    rTarget = (step > 1 ? step - 0.5 : step) * d;
    if (rTarget > diam) rTarget = diam
    var xyTarget = step * d;
    if (xyTarget > diam) xyTarget = diam
    switch (state) {
      case 0: pTarget.x = xyTarget * -1; pTarget.y = 0; break;  // arc top left
      case 1: pTarget.x = 0; pTarget.y = xyTarget * -1; break;  // arc bottom left
      case 2: pTarget.x = xyTarget; pTarget.y = 0; break; // arc bottom right
      case 3: pTarget.x = 0; pTarget.y = xyTarget; break; // arc top right
    }
    // idea to determine the center point of the new circle catched from
    // https://math.stackexchange.com/questions/1781438/finding-the-center-of-a-circle-given-two-points-and-a-radius-algebraically
    //
    // distance to center of rhombus
    const xa = 1 / 2 * (pTarget.x - pCurr.x)
    const ya = 1 / 2 * (pTarget.y - pCurr.y)
    // center of rhombus
    const p0 = { x: pCurr.x + xa, y: pCurr.y + ya }
    // half lenth of diagonales of rhombus
    const a = Math.sqrt(xa * xa + ya * ya)
    const b = Math.sqrt(rTarget * rTarget - a * a)
    // center of circle
    const pCenter = { x: p0.x + (ccw ? -1 : 1) * ((b * ya) / a), y: p0.y + (ccw ? 1 : -1) * ((b * xa) / a) }
    g(`;--${pCurr}, ${pTarget}, ${a}, ${b}, ${pCenter}`)
    g(`G${ccw ? 3 : 2} F${xyFeed} X${f(pTarget.x)} Y${f(pTarget.y)} I${f(pCenter.x - pCurr.x)} J${f(pCenter.y - pCurr.y)}`)

    pCurr.x = pTarget.x
    pCurr.y = pTarget.y
    state += ccw ? 1 : -1
    if (state < 0) state = 3
    if (state > 3) state = 0

    if (rTarget >= diam)
      remainingClosingCount--
  }
}

// mills a set of circles starting at 0/0/${z}, which needs to be the current position
function millCircles(diam, ccw, stepWidth, g, xyFeed) {
  var x = 0
  while (x < diam) {
    x += stepWidth
    if (x > diam) x = diam
    g(`G1 F${xyFeed} X${x} Y0; mill right to circle radius`)
    if (x > 0) {
      if (ccw) {
        g(`G3 F${xyFeed} X-${x} Y0 I-${x} J0; 1st half circle`)
        g(`G3 F${xyFeed} X${x} Y0 I${x} J0; 2nd half circle`)
      } else {
        g(`G2 F${xyFeed} X-${x} Y0 I-${x} J0; 1st half circle`)
        g(`G2 F${xyFeed} X${x} Y0 I${x} J0; 2nd half circle`)
      }
    }
    if (x >= diam) break
  }
}

function generateGCode(holeDiam, endmillDiam, zMovement, doc, woc, wocFinish, feedrate, receipe) {
  if (holeDiam < endmillDiam) { console.log("holeDiam < endmillDiam"); return }
  if (zMovement <= 0) { console.log("zMovement <=0"); return }
  if (doc < 10) { console.log("doc < 10"); return }
  if (doc > 200) { console.log("doc > 200"); return }
  if (woc < 5) { console.log("woc < 5"); return }
  if (woc > 30) { console.log("woc > 30"); return }
  if (wocFinish < 0) wocFinish = 0

  var x0 = 0
  var y0 = 0
  var z0 = 0
  var zSafe = 7

  var x = x0
  var y = y0
  var z = z0
  var xyFeed = feedrate
  var zFeed = feedrate / 2
  var xStep = endmillDiam * woc / 100;
  var finishOffset = endmillDiam * wocFinish / 100;
  var xMax = (holeDiam - endmillDiam - finishOffset) / 2
  if (xMax < 0) xMax = 0
  var xMax2 = (holeDiam - endmillDiam) / 2
  var stepDown = endmillDiam * doc / 100;
  const docFinish = 200
  const ccw = (() => {
    if (/^\w*-ccw/.test(receipe)) return 1
    else if (/^\w*-cw/.test(receipe)) return 0
    else return 1
  })()
  var gCode = ''
  function g(str) { gCode += str + '\n' }

  g(`; GCODE Generated by ob-hole-milling-macro on ${new Date().toISOString()}`)
  g(`; ${holeDiam}mm hole milling at 0/0/0 downto ${zMovement}`)
  g(`; endmill diameter=${endmillDiam}mm, DOC=${doc}%/${stepDown}mm, WOC=${woc}%/${xStep}mm`)
  g('G21; mm-mode')
  g('G54; Work Coordinates')
  g('G90; Absolute Positioning')
  g('M3 S1000; Spindle On')
  g('')
  g('; Begin of hole milling loop')
  g(`; Endmill Diameter: ${endmillDiam}`)
  g(`G0 Z${z0 + zSafe}; move to z-safe height`)
  g(`G0 F1000 X${x} Y${y}; move to x/y startpoint`)
  g('')


  // rough cut
  while (z > -zMovement) {
    z -= stepDown
    if (z < -zMovement) z = -zMovement
    g(`; layer ${z}`)
    g(`G1 F${zFeed} Z${z}; step down on current position`)

    if (xMax > 0) {
      if (/^circle/.test(receipe)) {
        millCircles(xMax, ccw, xStep, g, xyFeed)
      } else if (/^spiral/.test(receipe)) {
        millSpiral(xMax, ccw, xStep, g, xyFeed)
      } else {
        console.log(`unknown receipe:${receipe}`)
        return
      }
      x = 0
      g(`G1 F${xyFeed} X${x} Y0; move back to center`)
    }
  }

  // if we are not only drilling and not having a wocFinish of 0, then add a finishing cut
  if (xMax2 > xMax) {
    g('')
    g(`;--- finishing cut with DOC=${docFinish}%, WOC=${wocFinish}%`)
    g(`G0 Z${z0 + zSafe}; move to z-safe height`)
    g(`G0 F1000 X0 Y0 Z0; move up to zeropoint`)
    z = z0
    stepDown = endmillDiam * docFinish / 100;
    const ccw = (() => {
      if (/^\w*-\w*-ccw/.test(receipe)) return 1
      else if (/^\w*-\w*-cw/.test(receipe)) return 0
      else if (/^\w*-ccw/.test(receipe)) return 1
      else if (/^\w*-cw/.test(receipe)) return 0
      else return 1
    })()
    //g(`G1 F${zFeed} Z${z}; go back to z0`)
    while (z > -zMovement) {
      // step down
      z -= stepDown
      if (z < -zMovement) z = -zMovement
      g(`; layer ${z}`)
      g(`G1 F${zFeed} Z${z}; step down current position`)

      millCircles(xMax2, ccw, xMax2, g, xyFeed / 2)
      g(`G1 F${xyFeed} X${x} Y0; move to center`)
    }
  }
  // move tool back to save z
  g('')
  g('; End of hole milling loop')
  if (x != x0 || y != y0)
    g(`G1 F${xyFeed} X${x0} Y${y0}; move to center of hole`)
  g(`G0 F1000 Z${z0 + zSafe}; retracting back to z-safe`)
  g('')
  g('M5 S0; Spindle Off')
  g('; Job complete')

  // replace code in G-Code editor
  editor.session.setValue(gCode);

  // refresh 3D view
  parseGcodeInWebWorker(editor.getValue())

  // not required for the macro but for testing
  return gCode;
}

function genInputHtml(label, id, value, icon, descr, append = "") {
  const descrHtml = descr ? ` <small><i>(${descr})</i></small>` : ""
  var html = ''
  html += '<div class="row mb-1">\n'
  html += `  <label class= "cell-sm-8" > ${label}${descrHtml}</label >\n`
  html += '  <div class="cell-sm-4">\n'
  html += `    <input id="${id}" type="number" value="${value}" data-role="input" data-append="${append}" data-prepend="<i class='fas ${icon}'></i>" data-clear-button="false">\n`
  html += '  </div>\n'
  html += '</div>\n'
  return html
}
function genSelectHtml(label, id, options, selected, descr = '', opt = '') {
  const descrHtml = descr ? ` <small><i>(${descr})</i></small>` : ""
  var html = ''
  html += '<div class="row mb-1">\n'
  html += `  <label class="cell-sm-8">${label}${descrHtml}</label>\n`
  html += '  <div class="cell-sm-4">\n'
  html += `    <select id="${id}" data-role="select" ${opt}>\n`
  html += options.map(o => `      <option value="${o}"${o == selected ? ' selected="selected"' : ''}>${o}</option>\n`).join('')
  html += '    </select>\n'
  html += '  </div>\n'
  html += '</div>\n'
  return html
}

var prefs = {
  holeDiam: 8,
  endmillDiam: 4,
  holeDepth: 1,
  doc: 100,
  woc: 20,
  wocFinish: 2,
  feedrate: 500,
  receipe: "spiral-ccw-ccw"
}

function loadPrefs() { if (window.tmp_prefs_macro_hole_milling) prefs = window.tmp_prefs_macro_hole_milling }
function savePrefs() { window.tmp_prefs_macro_hole_milling = prefs }
loadPrefs();

// Dialog creation
Metro.dialog.create({
  title: 'Hole Milling',
  content:
    genInputHtml('Hole diameter', 'holeDiam', prefs.holeDiam, 'fa-circle', '', 'mm') +
    genInputHtml('Endmill diameter', 'endmillDiam', prefs.endmillDiam, 'fa-circle', '', 'mm') +
    genSelectHtml('Receipe', 'receipe', ['circle-cw-cw', 'circle-cw-ccw', 'circle-ccw-cw', 'circle-ccw-ccw',
      'spiral-cw-cw', 'spiral-cw-ccw', 'spiral-ccw-cw', 'spiral-ccw-ccw',], prefs.receipe, 'used to remove the material') +
    genInputHtml('Cutting depth', 'zMovement', prefs.holeDepth, 'fa-ruler', '', 'mm') +
    genInputHtml('DOC', 'doc', prefs.doc, 'fa-align-justify', 'depth of cut (10% - 200% of endmill diameter)', "%") +
    genInputHtml('WOC', 'woc', prefs.woc, 'fa-align-justify', 'width of cut (5% - 30% of endmill diameter)', "%") +
    genInputHtml('Finish WOC', 'wocFinish', prefs.wocFinish, 'fa-align-justify', 'width of cut for finish path (0 disables it)', "%") +
    genInputHtml('Feedrate', 'feedrate', prefs.feedrate, 'fa-running', 'How fast to move the endmill in milling operation', 'mm/min') +
    '',
  width: 700,
  actions: [
    {
      caption: "Generate G-Code",
      cls: "js-dialog-close success",
      onclick: function () {
        prefs.holeDiam = parseFloat($("#holeDiam").val())
        prefs.endmillDiam = parseFloat($("#endmillDiam").val())
        prefs.holeDepth = parseFloat($("#zMovement").val())
        prefs.doc = parseFloat($("#doc").val())
        prefs.woc = parseFloat($("#woc").val())
        prefs.wocFinish = parseFloat($("#wocFinish").val())
        prefs.feedrate = parseInt($("#feedrate").val())
        prefs.receipe = $('#receipe').val();
        const gCode = generateGCode(prefs.holeDiam, prefs.endmillDiam, prefs.holeDepth, prefs.doc, prefs.woc, prefs.wocFinish, prefs.feedrate, prefs.receipe)
        if (gCode)
          savePrefs();
      }
    }, {
      caption: "Cancel",
      cls: "js-dialog-close alert",
      onclick: function () {
      }
    }
  ]
});

// required for jest test 
try { module.exports = generateGCode; } catch (e) { }
