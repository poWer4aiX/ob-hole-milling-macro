const setValueMock = jest.fn(gCode => { })
const myFake = {
  editor: {
    session: {
      setValue: setValueMock
    },
    getValue: () => { }
  },
  Metro: {
    dialog: {
      create: () => { }
    }
  },
  parseGcodeInWebWorker: () => { }
}
const parseGcodeInWebWorker = jest.fn()
global.Metro = myFake.Metro
global.editor = myFake.editor
global.parseGcodeInWebWorker = parseGcodeInWebWorker

const generateGCode = require('../src/ob-hole-milling-macro');

function splitAndTrimGCode(gCode) {
  return gCode.split("\n")
    .map(l => l.replaceAll(/\s*;.*$/gm, ""))
    .filter(l => l.length > 0)
    .filter(l => !['G21', 'G54', 'G90', 'M3 S1000', 'M5 S0'].includes(l))
}

beforeEach(() => {
  setValueMock.mockClear();
  parseGcodeInWebWorker.mockClear();
});

describe("hole macro with a 4mm endmill", () => {

  // test if it handles invalid settings
  describe("should do nothing", () => {
    test("if there is no depth defined", () => {
      generateGCode(4, 4, 0, 1, 100, "");
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
    test("ff depth is negative", () => {
      generateGCode(4, 4, -10, 1, 100, "");
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
    test("ff step-down is 0", () => {
      generateGCode(4, 4, 10, 0, 100);
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
    test("ff step-down is negative", () => {
      generateGCode(4, 4, 10, -1, 100);
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
    test("if endmill diameter is smaller than hole diameter", () => {
      generateGCode(4, 5, 10, 1, 100, "");
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
  });

  // test if it updates the editor and 3D view
  describe("for valid settings, it", () => {
    it("should update the gCode editor", () => {
      generateGCode(4, 4, 1, 1, 100, "");
      expect(setValueMock).toHaveBeenCalled();
    });
    it("should trigger to parse it", () => {
      generateGCode(4, 4, 1, 1, 100, "");
      expect(parseGcodeInWebWorker).toHaveBeenCalled();
    });
  });

  describe("for a 1mm deep hole with 1mm step, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(4, 4, 1, 1, 100, ""));
    var i = 0
    it("should move to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
    it("should move to x0/y0", () => {
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
    });
    it("should mill down one step", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should go back to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  })

  describe("for a 3mm deep hole with 1mm step, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(4, 4, 3, 1, 100, ""));
    var i = 0
    it("should move to a save height, then to x0/y0", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
    });
    it("should mill down one step to -1mm", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should mill down a 2nd step to -2mm", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-2/)
    });
    it("should mill down a 3rd step to -3mm", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-3/)
    });
    it("should go back to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  describe("for a 3mm deep hole with 2mm step, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(4, 4, 3, 2, 100, ""));
    var i = 0
    it("should move to a save height, then to x0/y0", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
    });
    it("should mill down one step to -2mm", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-2/)
    });
    it("should mill down a 2nd 1/2 step to -3mm", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-3/)
    });
    it("should go back to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  // test one overlapping circle for an 8mm hole
  describe("for a 8mm hole, 1mm deep, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(8, 4, 1, 1, 100, ""));
    var i = 0
    it("should mill to 0/0/-1", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should mill to the outside at 2/0/-1", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
    });
    it("should mill two half circles", () => {
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should go back to center of hole", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
    });
    it("should go back to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  // test two overlapping circle for an 12mm hole
  describe("for a 8mm hole, 1mm deep, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(12, 4, 1, 1, 100, ""));
    var i = 0
    it("should mill to 0/0/-1", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should mill two half circles to the outside at 2/0/-1", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill two half circles to the outside at 4/0/-1", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X4 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-4 Y0 I-4 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X4 Y0 I4 J0/)
    });
    it("should go back to center of hole", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
    });
    it("should go back to a save height", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  // test one overlapping circle for an 8mm hole 3mm deep in zigzag
  describe("for a 8mm hole, 1mm deep in zig-zag, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(8, 4, 3, 1, 100, "zig-zag"));
    var i = 0
    it("should mill to 0/0/-1", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should mill two half circles to the outside at 2/0/-1", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should go go down one layer to -2", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-2/)
    });
    it("should mill two half circles at current position", () => {
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill back to the center", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
    });
    it("should go go down one layer to -3", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-3/)
    });
    it("should mill two half circles to the outside at 2/0/-3", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should go back to center of hole and to safe height", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  // test one overlapping circle for an 8mm hole 3mm deep in to-outer
  describe("for a 8mm hole, 1mm deep in to-outer mode, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(8, 4, 3, 1, 100, "to-outer"));
    var i = 0
    it("should mill to 0/0/-1", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
    });
    it("should mill two half circles to the outside at 2/0/-1", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill back to the center, then down to -2", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-2/)
    });
    it("should mill two half circles to the outside at 2/0/-2", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill back to the center, then down to -3", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* Z-3/)
    });
    it("should mill two half circles to the outside at 2/0/-3", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should go back to center of hole and to safe height", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

  // test one overlapping circle for an 8mm hole 3mm deep in to-center mode
  describe("for a 8mm hole, 1mm deep in to-center mode, it", () => {
    const gCode = splitAndTrimGCode(generateGCode(8, 4, 3, 1, 100, "to-center"));
    var i = 0
    it("should move to safe height, then to 0/2", () => {
      expect(gCode[i++]).toMatch("G0 Z7")
      expect(gCode[i++]).toMatch(/G0 F\d* X2 Y0/)
    });
    it("should mill down to -1, then two half circles at current position", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-1/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill to the center, then back to the outer edge", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y/)
    });

    it("should mill down to -2, then two half circles at current position", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-2/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill to the center, then back to the outer edge", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch(/G1 F\d* X2 Y0/)
    });

    it("should mill down to -3, then two half circles at current position", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* Z-3/)
      expect(gCode[i++]).toMatch(/G3 F\d* X-2 Y0 I-2 J0/)
      expect(gCode[i++]).toMatch(/G3 F\d* X2 Y0 I2 J0/)
    });
    it("should mill to the center, then to save height", () => {
      expect(gCode[i++]).toMatch(/G1 F\d* X0 Y0/)
      expect(gCode[i++]).toMatch("G0 Z7")
    });
  });

});

