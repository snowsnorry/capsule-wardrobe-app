const ru = {
  appName: "Capsule Wardrobe",
  marketingHeadline: "Соберите персональный капсульный гардероб и управляйте образами в одном месте.",
  locale: {
    label: "Язык",
    options: {
      en: "Английский",
      ru: "Русский"
    },
    flags: {
      en: "🇺🇸",
      ru: "🇷🇺"
    }
  },
  options: {
    styles: {
      casual: "Повседневный",
      formal: "Официальный",
      romantic: "Романтичный",
      minimal: "Минималистичный",
      sporty: "Спортивный",
      classic: "Классический",
      boho: "Бохо",
      streetwear: "Стритвир"
    },
    occasions: {
      office: "Офис",
      city_walk: "Прогулка по городу",
      school_dropoff: "Отвезти ребенка в школу",
      party: "Вечеринка",
      travel: "Путешествия",
      weekend: "Выходные",
      date_night: "Свидание",
      outdoor: "На природе"
    }
  },
  auth: {
    signInTitle: "Вход",
    signInSubtitleEmail: "Укажите email, чтобы получить код для входа",
    signInSubtitleCode: "Введите код из письма, чтобы продолжить",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendCode: "Отправить код",
    emailCodeLabel: "Код из письма",
    emailCodePlaceholder: "123456",
    verify: "Подтвердить",
    resendCode: "Отправить код снова",
    changeEmail: "Изменить email",
    tosNotice:
      "Нажимая «Отправить код», вы соглашаетесь с условиями сервиса и политикой конфиденциальности.",
    learnMore: "Подробнее",
    checkingSession: "Проверяем сессию",
    signedIn: "Вы вошли в систему.",
    signedOut: "Вы вышли из системы.",
    codeSent: "Код отправлен. Он будет действителен {minutes} минут."
  },
  main: {
    title: "Главная",
    welcome: "С возвращением",
    placeholder: "Ваш профиль готов. Основной экран появится здесь позже.",
    menuOpen: "Открыть меню",
    menuProfile: "Профиль",
    menuSignOut: "Выйти"
  },
  profile: {
    title: "Профиль",
    subtitle: "Обновите предпочтения и потребности гардероба.",
    stylesTitle: "Стилевые предпочтения",
    stylesHint: "Выберите хотя бы один стиль.",
    occasionsTitle: "Потребности гардероба",
    occasionsHint: "Выберите хотя бы один вариант.",
    back: "Назад",
    save: "Сохранить изменения",
    delete: "Удалить профиль",
    updated: "Профиль обновлен.",
    deleteConfirmTitle: "Удалить профиль",
    deleteConfirmBody: "Вы уверены, что хотите удалить профиль? Это действие нельзя отменить.",
    deleteConfirmCancel: "Отмена",
    deleteConfirmConfirm: "Удалить"
  },
  onboarding: {
    title: "Добро пожаловать",
    subtitle: "Давайте настроим профиль за несколько шагов.",
    step1Title: "Шаг 1 · Стилевые предпочтения",
    step1Hint: "Выберите хотя бы один стиль, который вам близок.",
    step2Title: "Шаг 2 · Потребности гардероба",
    step2Hint: "Выберите ситуации, для которых нужен гардероб.",
    step3Title: "Шаг 3 · Готово",
    step3Hint: "Профиль готов. Вы сможете изменить выбор в настройках профиля.",
    next: "Далее",
    start: "Начать"
  },
  actions: {
    signOut: "Выйти",
    cancel: "Отмена"
  },
  errors: {
    generic: "Что-то пошло не так. Попробуйте еще раз.",
    invalidEmail: "Проверьте формат email.",
    cooldown: "Подождите минуту перед повторной отправкой.",
    rateLimit: "Слишком много попыток. Попробуйте позже.",
    expired: "Код истек. Запросите новый.",
    maxAttempts: "Слишком много неверных попыток.",
    invalidCode: "Неверный код. Проверьте письмо.",
    profileExists: "Профиль уже существует.",
    profileNotFound: "Профиль не найден.",
    invalidPayload: "Выберите хотя бы один вариант."
  },
  dialogs: {
    signOutTitle: "Выйти",
    signOutBody: "Вы уверены, что хотите выйти?",
    signOutCancel: "Отмена",
    signOutConfirm: "Выйти"
  }
};

export default ru;
