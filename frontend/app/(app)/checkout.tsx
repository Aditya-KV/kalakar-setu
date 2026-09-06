import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, MapPin, Check, Banknote, Plus } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { useCart } from '../../features/cart/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { RequestFeedback } from '../../components/ui/RequestFeedback';
import { validateAddress, AddressForm } from '../../lib/address-validation';
import { apiClient } from '../../lib/api-client';
import { productText } from '../../lib/product-text';

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone_number: string;
  line1: string;
  line2: string | null;
  city: string;
  state_code: string;
  pincode: string;
  is_default: boolean;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { items, totalPrice, clearCart } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState(false);
  const [orderError, setOrderError] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const saveLock = useRef(false);
  const orderLock = useRef(false);

  const [form, setForm] = useState({
    label: 'Home',
    recipient_name: '',
    phone_number: '',
    line1: '',
    line2: '',
    city: '',
    state_code: '',
    pincode: '',
  });

  const fetchAddresses = () => {
    setAddressLoading(true);
    setAddressError(false);
    apiClient
      .get('/addresses')
      .then((res) => {
        setAddresses(res.data);
        const defaultAddr = res.data.find((a: Address) => a.is_default) || res.data[0];
        if (defaultAddr) setSelectedAddressId(defaultAddr.id);
        else setShowAddForm(true);
      })
      .catch(() => setAddressError(true))
      .finally(() => setAddressLoading(false));
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleSaveAddress = async () => {
    if (saveLock.current) return;
    const errors = validateAddress(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    saveLock.current = true;
    setSavingAddress(true);
    setSaveError(false);
    try {
      const res = await apiClient.post('/addresses', {
        ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])),
        state_code: form.state_code.trim().toUpperCase(),
        is_default: addresses.length === 0,
      });
      setAddresses((prev) => [res.data, ...prev]);
      setSelectedAddressId(res.data.id);
      setShowAddForm(false);
      setForm({ label: 'Home', recipient_name: '', phone_number: '', line1: '', line2: '', city: '', state_code: '', pincode: '' });
    } catch (e) {
      setSaveError(true);
    } finally {
      saveLock.current = false;
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || items.length === 0 || orderLock.current) return;
    orderLock.current = true;
    setPlacing(true);
    setOrderError(false);
    try {
      await apiClient.post('/orders', {
        items: items.map((i) => ({ listing_id: i.listingId, quantity: i.quantity })),
        delivery_address_id: selectedAddressId,
        payment_method: 'cod',
      });
      clearCart();
      Alert.alert(t('customer.orderPlaced'));
      router.replace('/(app)/(customer-tabs)/orders');
    } catch (e) {
      setOrderError(true);
    } finally {
      orderLock.current = false;
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <AnimatedPressable accessibilityLabel={t('common.back')} disabled={placing} onPress={() => router.back()} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>{t('customer.checkout')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('customer.deliverTo')}</Text>
        <RequestFeedback loading={addressLoading} error={addressError ? t('common.loadFailed') : null} onRetry={fetchAddresses} />

        {addresses.map((addr, index) => {
          const selected = selectedAddressId === addr.id;
          return (
            <Animated.View key={addr.id} entering={FadeInDown.delay(index * 60).duration(250)}>
              <AnimatedPressable
                style={[styles.addressCard, selected && styles.addressCardSelected]}
                onPress={() => setSelectedAddressId(addr.id)}
              >
                <View style={styles.addressIconCircle}>
                  <MapPin size={16} color={selected ? colors.primary : colors.textMuted} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{addr.label} · {addr.recipient_name}</Text>
                  <Text style={styles.addressText}>
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state_code} - {addr.pincode}
                  </Text>
                  <Text style={styles.addressText}>{addr.phone_number}</Text>
                </View>
                {selected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
              </AnimatedPressable>
            </Animated.View>
          );
        })}

        {!addressLoading && !addressError && (!showAddForm ? (
          <AnimatedPressable style={styles.addAddressButton} onPress={() => setShowAddForm(true)}>
            <Plus size={16} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addAddressText}>{t('customer.addAddress')}</Text>
          </AnimatedPressable>
        ) : (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.addForm}>
            <Input maxLength={100} label={t('customer.recipientName')} error={formErrors.recipient_name ? t(formErrors.recipient_name!) : undefined} value={form.recipient_name} onChangeText={(v) => setForm((f) => ({ ...f, recipient_name: v }))} />
            <Input label={t('customer.phoneNumber')} error={formErrors.phone_number ? t(formErrors.phone_number!) : undefined} value={form.phone_number} onChangeText={(v) => setForm((f) => ({ ...f, phone_number: v.replace(/[^0-9]/g, '') }))} keyboardType="phone-pad" maxLength={10} autoComplete="tel" />
            <Input maxLength={200} label={t('customer.addressLine1')} error={formErrors.line1 ? t(formErrors.line1!) : undefined} value={form.line1} onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))} />
            <Input maxLength={200} label={t('customer.addressLine2')} error={formErrors.line2 ? t(formErrors.line2!) : undefined} value={form.line2} onChangeText={(v) => setForm((f) => ({ ...f, line2: v }))} />
            <Input maxLength={100} label={t('customer.city')} error={formErrors.city ? t(formErrors.city!) : undefined} value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Input label={t('onboarding.stateLabel')} placeholder={t('customer.stateCodeHint')} autoCapitalize="characters" maxLength={2} error={formErrors.state_code ? t(formErrors.state_code!) : undefined} value={form.state_code} onChangeText={(v) => setForm((f) => ({ ...f, state_code: v }))} />
            <Input label={t('customer.pincode')} error={formErrors.pincode ? t(formErrors.pincode!) : undefined} value={form.pincode} onChangeText={(v) => setForm((f) => ({ ...f, pincode: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" maxLength={6} autoComplete="postal-code" />
            <RequestFeedback error={saveError ? t('customer.saveAddressFailed') : null} />
            <Button loading={savingAddress} title={t('customer.saveAddress')} onPress={handleSaveAddress} style={{ marginTop: Spacing.xs }} />
          </Animated.View>
        ))}

        <Text style={styles.sectionTitle}>{t('customer.paymentMethod')}</Text>
        <View style={styles.paymentCard}>
          <Banknote size={18} color={colors.primary} strokeWidth={2} />
          <Text style={styles.paymentText}>{t('orders.codLabel')}</Text>
          <Check size={16} color={colors.primary} strokeWidth={2.5} />
        </View>

        <Text style={styles.sectionTitle}>{t('customer.orderSummary')}</Text>
        <View style={styles.summaryCard}>
          {items.map((item) => (
            <View key={item.listingId} style={styles.summaryRow}>
              <Text style={styles.summaryItemText} numberOfLines={1}>
                {productText({ en: item.titleEn, hi: item.titleHi, mr: item.titleMr }, i18n.language)} × {item.quantity}
              </Text>
              <Text style={styles.summaryItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>{t('customer.total')}</Text>
            <Text style={styles.totalValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <RequestFeedback error={orderError ? t('customer.orderFailed') : null} />
        <Button
          title={placing ? t('customer.placingOrder') : t('customer.placeOrder')}
          onPress={handlePlaceOrder}
          loading={placing}
          disabled={!selectedAddressId || items.length === 0 || addressLoading || addressError || savingAddress}
          size="large"
        />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: Spacing.sm,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  addressIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  addAddressText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  addForm: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  paymentText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryItemText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginRight: Spacing.sm,
  },
  summaryItemPrice: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: Spacing.sm,
  },
  totalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
