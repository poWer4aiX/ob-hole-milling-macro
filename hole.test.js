//const rewire = require('rewire')
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

const generateGCode = require('./hole');

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
  describe("should do nothing", () => {
    test("if there is no depth defined", () => {
      generateGCode(4, 4, 0, 0, 100, "");
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
    test("if endmill diameter is smaller than hole diameter", () => {
      generateGCode(4, 5, 0, 1, 100, "");
      expect(setValueMock).not.toHaveBeenCalled();
      expect(parseGcodeInWebWorker).not.toHaveBeenCalled();
    });
  });

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

  test.todo("for a 5mm hole, 1mm deep, zigzag, it")
  test.todo("for a 5mm hole, 1mm deep, to-outer, it")
  test.todo("for a 5mm hole, 1mm deep, to-center, it")

  test.todo("for a 5mm hole, 3mm deep, 1mm step-down, zigzag, it")
  test.todo("for a 5mm hole, 3mm deep, 1mm step-down, to-outer, it")
  test.todo("for a 5mm hole, 3mm deep, 1mm step-down, to-center, it")

  test.todo("for a 10mm hole, 1mm deep, zigzag, it")
  test.todo("for a 10mm hole, 1mm deep, to-outer, it")
  test.todo("for a 10mm hole, 1mm deep, to-center, it")

  test.todo("for a 10mm hole, 3mm deep, 1mm step-down, zigzag, it")
  test.todo("for a 10mm hole, 3mm deep, 1mm step-down, to-outer, it")
  test.todo("for a 10mm hole, 3mm deep, 1mm step-down, to-center, it")

});

