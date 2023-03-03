import { BN } from "@project-serum/anchor";
import { ONE, Q128, ZERO } from "./constants";
import Decimal from "decimal.js";

export abstract class MathUtil {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mulDivRoundingUp(a: BN, b: BN, denominator: BN): BN {
    const numerator = a.mul(b);
    let result = numerator.div(denominator);
    if (!numerator.mod(denominator).eq(ZERO)) {
      result = result.add(ONE);
    }
    return result;
  }

  public static mulDivFloor(a: BN, b: BN, denominator: BN): BN {
    if (denominator.eq(ZERO)) {
      throw new Error("division by 0");
    }
    return a.mul(b).div(denominator);
  }

  public static mulDivCeil(a: BN, b: BN, denominator: BN): BN {
    // console.log(`mulDivCeil params: a: ${a.toString()}; b: ${b.toString()}; c: ${denominator.toString()}`);
    if (denominator.eq(ZERO)) {
      throw new Error("division by 0");
    }
    const numerator = a.mul(b).add(denominator.sub(ONE));
    // console.log(`mulDivCeil result: a: ${numerator.div(denominator).toString()}`);
    return numerator.div(denominator);
  }

  public static x64ToDecimal(num: BN, decimalPlaces?: number): Decimal {
    return new Decimal(num.toString())
      .div(Decimal.pow(2, 64))
      .toDecimalPlaces(decimalPlaces);
  }

  public static decimalToX64(num: Decimal): BN {
    return new BN(num.mul(Decimal.pow(2, 64)).floor().toFixed());
  }

  public static wrappingSubU128(n0: BN, n1: BN): BN {
    return n0.add(Q128).sub(n1).mod(Q128);
  }
}
