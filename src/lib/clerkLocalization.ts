import type { LocalizationResource } from '@clerk/types';
import type { Locale } from '@/i18n/locales';

const arabicClerkLocalization: LocalizationResource = {
  locale: 'ar',
  dividerText: 'أو',
  socialButtonsBlockButton: 'المتابعة باستخدام {{provider|titleize}}',
  socialButtonsBlockButtonManyInView: '{{provider|titleize}}',
  formFieldLabel__emailAddress: 'البريد الإلكتروني',
  formFieldLabel__emailAddress_username: 'البريد الإلكتروني',
  formFieldLabel__phoneNumber: 'رقم الهاتف',
  formFieldLabel__password: 'كلمة المرور',
  formFieldInputPlaceholder__emailAddress: 'أدخل بريدك الإلكتروني',
  formFieldInputPlaceholder__emailAddress_username: 'أدخل بريدك الإلكتروني',
  formFieldInputPlaceholder__phoneNumber: 'أدخل رقم هاتفك',
  formFieldInputPlaceholder__password: 'أدخل كلمة المرور',
  formButtonPrimary: 'متابعة',
  formButtonPrimary__verify: 'تحقق',
  backButton: 'رجوع',
  footerActionLink__useAnotherMethod: 'استخدم طريقة أخرى',
  unstable__errors: {
    form_password_length_too_short: 'يجب أن تتكوّن كلمة المرور من 8 أحرف أو أكثر.',
    passwordComplexity: {
      sentencePrefix: 'يجب أن تتكوّن كلمة المرور من',
      minimumLength: '8 أحرف أو أكثر',
      maximumLength: 'عدد أحرف مناسب',
      requireNumbers: 'رقم واحد على الأقل',
      requireLowercase: 'حرف صغير واحد على الأقل',
      requireUppercase: 'حرف كبير واحد على الأقل',
      requireSpecialCharacter: 'رمز خاص واحد على الأقل',
    },
  },
  signIn: {
    start: {
      title: 'تسجيل الدخول',
      titleCombined: 'تسجيل الدخول',
      subtitle: 'مرحباً بعودتك',
      subtitleCombined: 'مرحباً بعودتك',
      actionText: 'ليس لديك حساب؟',
      actionLink: 'إنشاء حساب',
    },
    password: {
      title: 'أدخل كلمة المرور',
      subtitle: 'تابع إلى حسابك',
      actionLink: 'استخدم طريقة أخرى',
    },
  },
  signUp: {
    start: {
      title: 'إنشاء حساب',
      titleCombined: 'إنشاء حساب',
      subtitle: 'ابدأ متجرك على سوقنا',
      subtitleCombined: 'ابدأ متجرك على سوقنا',
      actionText: 'لديك حساب؟',
      actionLink: 'تسجيل الدخول',
    },
    continue: {
      title: 'أكمل إنشاء الحساب',
      subtitle: 'تابع لإعداد حسابك',
      actionText: 'لديك حساب؟',
      actionLink: 'تسجيل الدخول',
    },
  },
};

export function clerkLocalization(locale: Locale): LocalizationResource | undefined {
  return locale === 'ar' ? arabicClerkLocalization : undefined;
}
