import { SETTINGS_DEFAULTS, SETTINGS_KEY, SettingsDocument, SettingsModel } from "../models/settings.model";
import { DriverPayRates } from "../types/settings.types";
import { SettingsInput } from "../validators/settings.validator";

/**
 * The settings document is created on first read, so a fresh database still has
 * working defaults and the admin screen has something to edit.
 */
export const getSettings = async (): Promise<SettingsDocument> => {
  const existing = await SettingsModel.findOne({ key: SETTINGS_KEY }).exec();

  if (existing) return existing;

  return SettingsModel.create({ ...SETTINGS_DEFAULTS, key: SETTINGS_KEY });
};

/** Read once per request that prices deliveries, then reused across the list. */
export const getDriverPayRates = async (): Promise<DriverPayRates> => {
  const settings = await getSettings();

  return { basePay: settings.driverBasePay, payPerKm: settings.driverPayPerKm };
};

/** What the customer is charged on the subtotal at checkout. */
export const getServiceFeeRate = async (): Promise<number> => {
  const settings = await getSettings();

  return settings.serviceFeeRate;
};

/** The rate a restaurant is charged: its own, else the platform default. */
export const commissionRateFor = async (override?: number): Promise<number> => {
  if (override !== undefined && override !== null) return override;

  const settings = await getSettings();

  return settings.restaurantCommissionRate;
};

/** The COD rules the checkout is validated against. */
export const getCodPolicy = async (): Promise<{
  enabled: boolean;
  maxOrderValue: number;
  maxOpenOrders: number;
}> => {
  const settings = await getSettings();

  return {
    enabled: settings.codEnabled,
    maxOpenOrders: settings.codMaxOpenOrders,
    maxOrderValue: settings.codMaxOrderValue,
  };
};

export const updateSettings = async (
  adminId: string,
  input: SettingsInput,
): Promise<SettingsDocument> => {
  const settings = await getSettings();

  if (input.driverBasePay !== undefined) settings.driverBasePay = input.driverBasePay;
  if (input.driverPayPerKm !== undefined) settings.driverPayPerKm = input.driverPayPerKm;
  if (input.restaurantCommissionRate !== undefined) {
    settings.restaurantCommissionRate = input.restaurantCommissionRate;
  }
  if (input.serviceFeeRate !== undefined) settings.serviceFeeRate = input.serviceFeeRate;
  if (input.codEnabled !== undefined) settings.codEnabled = input.codEnabled;
  if (input.codMaxOrderValue !== undefined) settings.codMaxOrderValue = input.codMaxOrderValue;
  if (input.codMaxOpenOrders !== undefined) settings.codMaxOpenOrders = input.codMaxOpenOrders;

  settings.updatedBy = adminId as never;
  await settings.save();

  return settings;
};
