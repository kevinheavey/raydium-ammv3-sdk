import {
  getInitializedTickArrayInRange,
  mergeTickArrayBitmap,
  checkTickArrayIsInitialized,
  getTickArrayStartIndexByTick,
  calcBitPosAndMultiplier
} from "./tickArray";

import { assert, expect } from "chai";
import { BN } from "@project-serum/anchor";

function signedRightShift(n0: BN, shiftBy: number, bitWidth: number) {
  let twoN0 = n0.toTwos(bitWidth).shrn(shiftBy);
  twoN0.imaskn(bitWidth - shiftBy + 1);
  return twoN0.fromTwos(bitWidth - shiftBy);
}

function signedRightShiftNoTwos(n0: BN, shiftBy: number, bitWidth: number) {
  return n0.shrn(shiftBy).imaskn(bitWidth - shiftBy + 1);
}

describe("tick array test", async () => {
  it("getInitializedTickArrayInRange", () => {
    let bns: BN[] = [
      new BN("1"), // -409600
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("9223372036854775808"), // -52000
      new BN("16140901064495857665"), // -800, -1600, -2400, -51200
      new BN("7"), // 0, 800, 1600
      new BN("1"), // 51200
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("9223372036854775808"), // 408800
    ];
    let bitmap = mergeTickArrayBitmap(bns);
    assert.deepEqual(
      getInitializedTickArrayInRange(bitmap, 10, 0, 7),
      [-600, -1200, -1800, -38400, -39000, -307200, 0, 600, 1200, 38400, 306600]
    );
  });

  it("getInitializedTickArrayInRange", () => {
    let bns: BN[] = [
      new BN("1"), // -409600
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("9223372036854775808"), // -52000
      new BN("16140901064495857665"), // -800, -1600, -2400, -51200
      new BN("7"), // 0, 800, 1600
      new BN("1"), // 51200
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("0"),
      new BN("9223372036854775808"), // 408800
    ];
    let bitmap = mergeTickArrayBitmap(bns);
    let [isInitialized, startIndex] = checkTickArrayIsInitialized(
      bitmap,
      0,
      10
    );
    assert.equal(isInitialized, true);
    let [bit_pos, multiplier] = calcBitPosAndMultiplier(-800, 10);
    assert.equal(bit_pos, 510);
    assert.equal(multiplier, 600);
    [isInitialized, startIndex] = checkTickArrayIsInitialized(bitmap, -800, 10);
    assert.equal(isInitialized, true);
    assert.equal(startIndex, -1200);
    [bit_pos, multiplier] = calcBitPosAndMultiplier(-20, 10);
    assert.equal(bit_pos, 511);
    assert.equal(multiplier, 600);
    [isInitialized, startIndex] = checkTickArrayIsInitialized(bitmap, -20, 10);
    assert.equal(isInitialized, true);
    assert.equal(startIndex, -600);
    [isInitialized, startIndex] = checkTickArrayIsInitialized(bitmap, 20, 10);
    assert.equal(isInitialized, true);
    assert.equal(startIndex, 0);
    [isInitialized, startIndex] = checkTickArrayIsInitialized(bitmap, 800, 10);
    assert.equal(isInitialized, true);
    assert.equal(startIndex, 600);
  });

  it("tick index wat", function() {
    assert.equal(getTickArrayStartIndexByTick(100, 3), 0);
    assert.equal(getTickArrayStartIndexByTick(180, 3), 180);
    assert.equal(getTickArrayStartIndexByTick(180.2, 3), 180);
  });

  // it("signedRightShift", function() {
  //   assert.equal()
  // })
});
