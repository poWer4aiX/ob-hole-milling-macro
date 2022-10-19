
function generateGCode(holeDiam, endmillDiam, zMovement, stepDown, feedrate, mode) {
  if (holeDiam < endmillDiam || zMovement <= 0 || stepDown <= 0) {
    return;
  }

  var x0 = 0
  var y0 = 0
  var z0 = 0
  var zSafe = 7

  var x = x0
  var y = y0
  var z = z0
  var xyFeed = feedrate
  var zFeed = feedrate / 2
  var xStep = endmillDiam / 2;  // 50% overlapping
  var xMax = (holeDiam - endmillDiam) / 2

  var gCode = ''
  function g(str) {gCode += str+'\n'}

  if(mode == 'to-center') x=xMax

  g(`; GCODE Generated by ???? on ?????`)
  g(`; hole milling at 0/0/0 downto ${zMovement} in ${stepDown}mm steps`)
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

  var forwardDir = 1 // 1= center to outer circle, 0= back to center

  while (z >= -zMovement) {
    if (mode == 'to-outer') {
      forwardDir = 1
      if (x > 0) {
        x=0
        g(`G1 F${xyFeed} X${x} Y0; move to center`)
      }
    } else if (mode == 'to-center') {
      forwardDir = 0
      if (x < xMax) {
        x=xMax
        g(`G1 F${xyFeed} X${x} Y0; move to outer pos`)
      }
    }
    // step down
    z -= stepDown
    if (z < -zMovement) z = -zMovement
    g(`; layer ${z}`)
    g(`G1 F${zFeed} Z${z}; step down on current position`)
    if (x > 0) {
      g(`G3 F${xyFeed} X-${x} Y0 I-${x} J0; 1st half circle`)
      g(`G3 F${xyFeed} X${x} Y0 I${x} J0; 2nd half circle`)
    }
    // x/y movement for circle milling
    if (forwardDir) {
      g(';forwards')
      while (x < xMax) {
        x += xStep
        if (x > xMax) x = xMax
        g(`G1 F${xyFeed} X${x} Y0; move to x/y`)
        if (x > 0) {
          g(`G3 F${xyFeed} X-${x} Y0 I-${x} J0; 1st half circle`)
          g(`G3 F${xyFeed} X${x} Y0 I${x} J0; 2nd half circle`)
        }
        if (x >= xMax) break
      }
    } else {
      g(';backwards')
      while (x > 0) {
        x -= xStep
        if (x < 0) x = 0
        g(`G1 F${xyFeed} X${x} Y0; move to x/y`)
        if (x > 0) {
          g(`G3 F${xyFeed} X-${x} Y0 I-${x} J0; 1st half circle`)
          g(`G3 F${xyFeed} X${x} Y0 I${x} J0; 2nd half circle`)
        }
        if (x <= 0) break
      }
    }

    // check for endCondition
    if (z <= -zMovement)
      break
    forwardDir = !forwardDir
  }

  // move tool back to save z
  g('')
  g('; End of hole milling loop')
  if (x != x0 || y != y0)
    g(`G1 F${xyFeed} X${x0} Y${y0}; move to center of hole`)
  g(`G0 Z${z0 + zSafe}; retracting back to z-safe`)
  g('')
  g('M5 S0; Spindle Off')
  g('; Job completed')

  // replace code in G-Code editor
  editor.session.setValue(gCode);

  // refresh 3D view
  parseGcodeInWebWorker(editor.getValue())

  // not required for the macro but for testing
  return gCode;
}

function genInputHtml(label, id, value, icon, descr) {
  var html = ''
  html += '<div class="row mb-0">\n'
  html += `  <label class= "cell-sm-6" > ${label}</label >\n`
  html += '  <div class="cell-sm-6">\n'
  html += `    <input id="${id}" type="number" value="${value}" data-role="input" data-append="mm" data-prepend="<i class='fas ${icon}'></i>" data-clear-button="false">\n`
  html += '  </div>\n'
  html += '</div>\n'
  if (descr)
    html += `<small>${descr}</small>`
  html += '<hr>\n'
  return html
}
function genSelectHtml(label, id, options, descr='', opt='') {
  var html = ''
  html += '<div class="row mb-0">\n'
  html += `  <label class="cell-sm-6">${label}</label>\n`
  html += '  <div class="cell-sm-6">\n'
  html += `    <select id="${id}" data-role="select" ${opt}>\n`
  html += options.map(o => `      <option value="${o}">${o}</option>\n`).join('')
  html += '    </select>\n'
  html += '  </div>\n'
  html += '</div>\n'
  if (descr)
    html += `<small>${descr}</small>`
  html += '<hr>\n'
  return html
}

// Dialog creation
Metro.dialog.create({
  title: 'Hole Milling',
  content:
    genInputHtml('Hole diameter', 'holeDiam', 6, 'fa-circle', '') +
    genInputHtml('Endmill diameter', 'endmillDiam', 4, 'fa-circle', '') +
    genInputHtml('Cutting depth', 'zMovement', 10, 'fa-ruler', '') +
    genInputHtml('Step-down', 'stepDown', 1, 'fa-align-justify', '') +
    genInputHtml('Feedrate', 'feedrate', 100, 'fa-running', 'How fast to move the endmill in milling operation') +
    genSelectHtml('Mode', 'mode', ['zig-zag', 'to-outer', 'to-center']),
    actions: [
    {
      caption: "Generate G-Code",
      cls: "js-dialog-close success",
      onclick: function () {
        const holeDiam = parseFloat($("#holeDiam").val())
        const endmillDiam = parseFloat($("#endmillDiam").val())
        const zMovement = parseFloat($("#zMovement").val())
        const stepDown = parseFloat($("#stepDown").val())
        const feedrate = parseInt($("#feedrate").val())
        const mode = $('#mode').val();
        generateGCode(holeDiam, endmillDiam, zMovement, stepDown, feedrate, mode)
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
if (process.env.JEST_WORKER_ID !== undefined)
  module.exports = generateGCode;