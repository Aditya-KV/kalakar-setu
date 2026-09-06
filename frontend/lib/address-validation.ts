export interface AddressForm {
  recipient_name: string; phone_number: string; line1: string; line2: string;
  city: string; state_code: string; pincode: string; label: string;
}

export function validateAddress(form: AddressForm): Partial<Record<keyof AddressForm, string>> {
  const errors: Partial<Record<keyof AddressForm, string>> = {};
  for (const field of ['recipient_name', 'line1', 'city', 'state_code'] as const) {
    if (!form[field].trim()) errors[field] = 'common.required';
  }
  if (!/^[6-9]\d{9}$/.test(form.phone_number.trim())) errors.phone_number = 'customer.phoneInvalid';
  if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) errors.pincode = 'customer.pincodeInvalid';
  if (form.state_code.trim() && !/^[A-Z]{2}$/.test(form.state_code.trim().toUpperCase())) errors.state_code = 'customer.stateCodeHint';
  return errors;
}
