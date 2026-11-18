// app/legal/documents.ts — public offer / terms, privacy policy and seller contacts (Russian, Kazakh, English;
// other interface languages show the English text). Prices come from the server ({month}, {year}, {trial},
// {currency}) so the offer always matches the teacher page. Seller details live only in SELLER below.

export const SELLER = {
  name: { ru: "ИП «PC Arena»", kz: "«PC Arena» ЖК", en: "Sole proprietor “PC Arena”" },
  owner: { ru: "Сержанұлы Еларыс", kz: "Сержанұлы Еларыс", en: "Serzhanuly Yelarys" },
  iin: "080924654214",
  address: {
    ru: "Республика Казахстан, г. Алматы, Алатауский район, мкр. Алгабас, ул. Омарова, д. 16",
    kz: "Қазақстан Республикасы, Алматы қ., Алатау ауданы, Алғабас ш/а, Омаров к-сі, 16 үй",
    en: "16 Omarov St., Algabas microdistrict, Alatau district, Almaty, Republic of Kazakhstan",
  },
  email: "elarys.juz@gmail.com",
  phone: "+7 700 476 91 01",
  site: "pixelcode-arena.onrender.com",
};

export type DocId = "offer" | "privacy" | "contacts";
export type DocLang = "ru" | "kz" | "en";
export type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

const UPDATED = { ru: "Редакция от 18 ноября 2026 г.", kz: "2026 жылғы 18 қарашадағы редакция", en: "Version of 18 November 2026" };

const seller = (l: DocLang) =>
  l === "ru"
    ? [
        `${SELLER.name.ru}, индивидуальный предприниматель ${SELLER.owner.ru}`,
        `ИИН: ${SELLER.iin}`,
        `Адрес: ${SELLER.address.ru}`,
        `E-mail: ${SELLER.email}`,
        `Телефон, WhatsApp: ${SELLER.phone}`,
        "Налоговый режим: упрощённая декларация, не является плательщиком НДС.",
      ]
    : l === "kz"
      ? [
          `${SELLER.name.kz}, жеке кәсіпкер ${SELLER.owner.kz}`,
          `ЖСН: ${SELLER.iin}`,
          `Мекенжайы: ${SELLER.address.kz}`,
          `E-mail: ${SELLER.email}`,
          `Телефон, WhatsApp: ${SELLER.phone}`,
          "Салық режимі: оңайлатылған декларация, ҚҚС төлеуші емес.",
        ]
      : [
          `${SELLER.name.en}, sole proprietor ${SELLER.owner.en}`,
          `IIN (individual identification number): ${SELLER.iin}`,
          `Address: ${SELLER.address.en}`,
          `E-mail: ${SELLER.email}`,
          `Phone, WhatsApp: ${SELLER.phone}`,
          "Tax regime: simplified declaration; not a VAT payer.",
        ];

const OFFER: Record<DocLang, Doc> = {
  ru: {
    title: "Публичная оферта и пользовательское соглашение",
    updated: UPDATED.ru,
    sections: [
      {
        h: "1. Общие положения",
        p: [
          `Настоящий документ — публичная оферта ${SELLER.name.ru} (далее — Исполнитель) в соответствии со статьёй 395 Гражданского кодекса Республики Казахстан, адресованная любому лицу (далее — Пользователь), и пользовательское соглашение сервиса PixelCode Arena на сайте ${SELLER.site} (далее — Сервис).`,
          "Регистрируясь в Сервисе, входя в урок, начиная пробный период или оплачивая подписку, Пользователь подтверждает, что прочитал и принимает условия этого документа и Политики конфиденциальности.",
        ],
      },
      {
        h: "2. Что предоставляет Сервис",
        p: [
          "Игровая часть (матчи, тренировка, рейтинг, магазин скинов за внутриигровую валюту PIXELS) предоставляется бесплатно. PIXELS не являются деньгами, не продаются и не обмениваются на деньги.",
          "Платная услуга — «Режим учителя»: создание уроков для класса, вход учеников по коду или QR-коду, выбор задач и создание собственных задач, живая таблица результатов и просмотр решений учеников.",
        ],
      },
      {
        h: "3. Пробный период",
        p: [
          "Каждый аккаунт может один раз бесплатно получить «Режим учителя» на {trial} дней. Пробный период начинается сразу после нажатия кнопки и заканчивается автоматически; оплата за него не взимается и данные карты не нужны.",
        ],
      },
      {
        h: "4. Тарифы и порядок оплаты",
        p: [
          "Подписка на 1 месяц (30 дней) — {month} {currency}; подписка на учебный год (365 дней) — {year} {currency}. Актуальные цены всегда указаны на странице «Для учителей». Цены указаны без НДС (Исполнитель не является плательщиком НДС).",
          "Пользователь оставляет заявку на странице «Для учителей». Исполнитель связывается с ним и выставляет счёт или ссылку на оплату через Kaspi (Kaspi Pay, QR, счёт на оплату) либо другим доступным способом.",
          "Доступ включается в течение 1 рабочего дня после поступления оплаты. При продлении новый срок прибавляется к оставшемуся.",
          "После окончания подписки создавать новые уроки и задачи нельзя, но ранее проведённые уроки и их результаты остаются доступны Пользователю.",
        ],
      },
      {
        h: "5. Возврат денег",
        p: [
          "Пользователь может отказаться от подписки и получить полный возврат, если обратится в течение 7 календарных дней после оплаты и за это время в оплаченный период не было проведено (запущено) ни одного урока.",
          `Для возврата напишите на ${SELLER.email} с указанием имени аккаунта и даты оплаты. Деньги возвращаются тем же способом, которым была произведена оплата, в течение 10 рабочих дней; доступ при этом отключается.`,
          "В остальных случаях оплата за начатый период не возвращается, кроме случаев, когда Сервис был недоступен по вине Исполнителя более 3 дней подряд: тогда срок подписки продлевается на время недоступности или, по выбору Пользователя, возвращается соответствующая часть оплаты.",
        ],
      },
      {
        h: "6. Обязанности сторон",
        p: [
          "Исполнитель обеспечивает работу Сервиса, хранит данные уроков и отвечает на обращения в течение 2 рабочих дней.",
          "Пользователь не передаёт доступ к своему аккаунту третьим лицам, не пытается нарушить работу Сервиса, не загружает вредоносный код и запрещённые материалы, а при проведении уроков с несовершеннолетними учениками отвечает за наличие у школы или родителей согласия на участие (ученики входят только по имени, без регистрации).",
          "Исполнитель может заблокировать аккаунт, нарушающий эти условия.",
        ],
      },
      {
        h: "7. Ответственность",
        p: [
          "Сервис предоставляется «как есть». Исполнитель не отвечает за перебои, вызванные интернет-провайдерами, хостингом и обстоятельствами непреодолимой силы, и проводит плановые работы, по возможности предупреждая о них заранее.",
          "Ответственность Исполнителя ограничена суммой, оплаченной Пользователем за текущий период подписки.",
        ],
      },
      {
        h: "8. Изменение условий и споры",
        p: [
          "Исполнитель может изменять этот документ, публикуя новую редакцию на этой странице; для уже оплаченного периода действуют условия на момент оплаты.",
          "Споры решаются путём переговоров, а при недостижении согласия — в суде по месту нахождения Исполнителя в соответствии с законодательством Республики Казахстан.",
        ],
      },
      { h: "9. Реквизиты Исполнителя", p: seller("ru") },
    ],
  },
  kz: {
    title: "Жария оферта және пайдаланушы келісімі",
    updated: UPDATED.kz,
    sections: [
      {
        h: "1. Жалпы ережелер",
        p: [
          `Бұл құжат — Қазақстан Республикасы Азаматтық кодексінің 395-бабына сәйкес кез келген тұлғаға (бұдан әрі — Пайдаланушы) арналған ${SELLER.name.kz} (бұдан әрі — Орындаушы) жария офертасы және ${SELLER.site} сайтындағы PixelCode Arena сервисінің (бұдан әрі — Сервис) пайдаланушы келісімі.`,
          "Сервисте тіркелу, сабаққа кіру, сынақ мерзімін бастау немесе жазылымды төлеу арқылы Пайдаланушы осы құжаттың және Құпиялылық саясатының шарттарын оқып, қабылдағанын растайды.",
        ],
      },
      {
        h: "2. Сервис не ұсынады",
        p: [
          "Ойын бөлігі (матчтар, жаттығу, рейтинг, PIXELS ойын валютасына скин дүкені) тегін ұсынылады. PIXELS ақша емес, сатылмайды және ақшаға айырбасталмайды.",
          "Ақылы қызмет — «Мұғалім режимі»: сыныпқа сабақ құру, оқушылардың код немесе QR-код арқылы кіруі, тапсырмаларды таңдау және өз тапсырмаларын құру, нәтижелердің тікелей кестесі және оқушылар шешімдерін қарау.",
        ],
      },
      {
        h: "3. Сынақ мерзімі",
        p: [
          "Әр аккаунт «Мұғалім режимін» {trial} күнге бір рет тегін ала алады. Сынақ мерзімі батырманы басқан бойда басталып, өздігінен аяқталады; ол үшін төлем алынбайды, карта деректері қажет емес.",
        ],
      },
      {
        h: "4. Тарифтер және төлем тәртібі",
        p: [
          "1 айлық жазылым (30 күн) — {month} {currency}; оқу жылына жазылым (365 күн) — {year} {currency}. Өзекті бағалар әрқашан «Мұғалімдерге» бетінде көрсетіледі. Бағалар ҚҚС-сыз (Орындаушы ҚҚС төлеуші емес).",
          "Пайдаланушы «Мұғалімдерге» бетінде өтініш қалдырады. Орындаушы онымен байланысып, Kaspi арқылы (Kaspi Pay, QR, төлем шоты) немесе басқа қолжетімді тәсілмен шот не төлем сілтемесін жібереді.",
          "Төлем түскеннен кейін 1 жұмыс күні ішінде қолжетімділік қосылады. Ұзартқанда жаңа мерзім қалған мерзімге қосылады.",
          "Жазылым аяқталғаннан кейін жаңа сабақтар мен тапсырмалар құруға болмайды, бірақ бұрын өткізілген сабақтар мен олардың нәтижелері Пайдаланушыға қолжетімді болып қалады.",
        ],
      },
      {
        h: "5. Ақшаны қайтару",
        p: [
          "Егер Пайдаланушы төлемнен кейін 7 күнтізбелік күн ішінде жүгінсе және осы уақытта төленген кезеңде бірде-бір сабақ өткізілмесе (іске қосылмаса), жазылымнан бас тартып, толық соманы қайтарып ала алады.",
          `Қайтару үшін аккаунт атауы мен төлем күнін көрсетіп, ${SELLER.email} мекенжайына жазыңыз. Ақша 10 жұмыс күні ішінде төлем жасалған тәсілмен қайтарылады; қолжетімділік өшіріледі.`,
          "Басқа жағдайларда басталған кезең үшін төлем қайтарылмайды, Сервис Орындаушының кінәсінен қатарынан 3 күннен артық қолжетімсіз болған жағдайларды қоспағанда: онда жазылым мерзімі қолжетімсіз болған уақытқа ұзартылады немесе Пайдаланушының таңдауы бойынша төлемнің тиісті бөлігі қайтарылады.",
        ],
      },
      {
        h: "6. Тараптардың міндеттері",
        p: [
          "Орындаушы Сервистің жұмысын қамтамасыз етеді, сабақ деректерін сақтайды және өтініштерге 2 жұмыс күні ішінде жауап береді.",
          "Пайдаланушы аккаунтына кіруді үшінші тұлғаларға бермейді, Сервистің жұмысын бұзуға тырыспайды, зиянды код пен тыйым салынған материалдарды жүктемейді, ал кәмелетке толмаған оқушылармен сабақ өткізгенде мектептің немесе ата-аналардың қатысуға келісімі болуына жауап береді (оқушылар тек атымен, тіркелусіз кіреді).",
          "Орындаушы осы шарттарды бұзған аккаунтты бұғаттай алады.",
        ],
      },
      {
        h: "7. Жауапкершілік",
        p: [
          "Сервис «бар күйінде» ұсынылады. Орындаушы интернет-провайдерлер, хостинг және еңсерілмейтін күш жағдайлары тудырған үзілістер үшін жауап бермейді, жоспарлы жұмыстар туралы мүмкіндігінше алдын ала ескертеді.",
          "Орындаушының жауапкершілігі Пайдаланушы ағымдағы жазылым кезеңі үшін төлеген сомамен шектеледі.",
        ],
      },
      {
        h: "8. Шарттарды өзгерту және даулар",
        p: [
          "Орындаушы жаңа редакцияны осы бетте жариялау арқылы құжатты өзгерте алады; төленген кезеңге төлем сәтіндегі шарттар қолданылады.",
          "Даулар келіссөз арқылы, ал келісімге қол жеткізілмесе — Қазақстан Республикасының заңнамасына сәйкес Орындаушы орналасқан жердегі сотта шешіледі.",
        ],
      },
      { h: "9. Орындаушының деректемелері", p: seller("kz") },
    ],
  },
  en: {
    title: "Public offer and terms of use",
    updated: UPDATED.en,
    sections: [
      {
        h: "1. General",
        p: [
          `This document is a public offer by ${SELLER.name.en} (the Provider) under Article 395 of the Civil Code of the Republic of Kazakhstan, addressed to anyone (the User), and the terms of use of the PixelCode Arena service at ${SELLER.site} (the Service).`,
          "By registering, joining a lesson, starting a trial or paying for a subscription, the User confirms having read and accepted this document and the Privacy policy.",
        ],
      },
      {
        h: "2. What the Service provides",
        p: [
          "The game (matches, practice, rating, the skin store for the in-game currency PIXELS) is free. PIXELS are not money, are not sold and cannot be exchanged for money.",
          "The paid service is Teacher mode: lessons for a class, students joining by code or QR code, choosing tasks and writing your own, a live results table and reading students' solutions.",
        ],
      },
      {
        h: "3. Free trial",
        p: [
          "Each account can get Teacher mode free of charge once, for {trial} days. The trial starts as soon as the button is pressed and ends by itself; no payment and no card details are required.",
        ],
      },
      {
        h: "4. Prices and payment",
        p: [
          "1-month subscription (30 days): {month} {currency}; school-year subscription (365 days): {year} {currency}. Current prices are always shown on the For teachers page. Prices do not include VAT (the Provider is not a VAT payer).",
          "The User sends a request on the For teachers page. The Provider contacts them and sends an invoice or a payment link via Kaspi (Kaspi Pay, QR, invoice) or another available method.",
          "Access is switched on within 1 business day after the payment arrives. A renewal adds the new period to what is left.",
          "After a subscription ends, new lessons and tasks cannot be created, but past lessons and their results stay available to the User.",
        ],
      },
      {
        h: "5. Refunds",
        p: [
          "The User may cancel and get a full refund within 7 calendar days of the payment if no lesson was run (started) in the paid period during that time.",
          `To request a refund, write to ${SELLER.email} with your account name and the payment date. The money is returned the same way it was paid within 10 business days, and access is switched off.`,
          "Otherwise payment for a started period is not refunded, except when the Service was unavailable through the Provider's fault for more than 3 days in a row: then the subscription is extended by that time or, at the User's choice, the corresponding part of the payment is refunded.",
        ],
      },
      {
        h: "6. Obligations",
        p: [
          "The Provider keeps the Service running, stores lesson data and answers requests within 2 business days.",
          "The User does not share account access, does not try to disrupt the Service, does not upload malicious code or prohibited material, and when running lessons with minors is responsible for the school's or parents' consent to take part (students join with a name only, without an account).",
          "The Provider may block an account that breaks these terms.",
        ],
      },
      {
        h: "7. Liability",
        p: [
          "The Service is provided as is. The Provider is not liable for outages caused by internet providers, hosting or force majeure, and announces planned maintenance in advance where possible.",
          "The Provider's liability is limited to the amount the User paid for the current subscription period.",
        ],
      },
      {
        h: "8. Changes and disputes",
        p: [
          "The Provider may change this document by publishing a new version on this page; a period already paid for follows the terms in force at the time of payment.",
          "Disputes are settled by negotiation or, failing that, in court at the Provider's location under the laws of the Republic of Kazakhstan.",
        ],
      },
      { h: "9. Provider details", p: seller("en") },
    ],
  },
};

const PRIVACY: Record<DocLang, Doc> = {
  ru: {
    title: "Политика конфиденциальности",
    updated: UPDATED.ru,
    sections: [
      {
        h: "1. Кто обрабатывает данные",
        p: [
          `Оператор персональных данных — ${SELLER.name.ru} (${SELLER.owner.ru}, ИИН ${SELLER.iin}). Обработка ведётся в соответствии с Законом Республики Казахстан «О персональных данных и их защите». Вопросы по данным: ${SELLER.email}.`,
        ],
      },
      {
        h: "2. Какие данные мы храним",
        p: [
          "Аккаунт: имя пользователя, e-mail (по желанию), хэш пароля (сам пароль не хранится), аватар, выбранный язык.",
          "Игра: рейтинг, результаты и повторы матчей (повторы хранятся 14 дней), достижения, покупки за PIXELS, список друзей, решения задач.",
          "Уроки: имя, которое ученик ввёл при входе (без регистрации и контактов), его решения задач, попытки и время; названия уроков и задачи учителя.",
          "Заявки на подписку: название школы или курсов, контакт для связи (телефон, WhatsApp или e-mail), комментарий.",
          "Технические данные: IP-адрес и время запросов — только для защиты от злоупотреблений, в журналах сервера.",
        ],
      },
      {
        h: "3. Зачем",
        p: [
          "Чтобы Сервис работал: вход в аккаунт, матчи, рейтинг, уроки и таблица для учителя; восстановление пароля по e-mail; связь по заявкам и оплате; защита от взлома и спама.",
          "Мы не продаём данные, не показываем рекламу и не передаём данные третьим лицам, кроме перечисленных ниже сервисов, без которых Сайт не работает.",
        ],
      },
      {
        h: "4. Где хранятся данные",
        p: [
          "Сервер и база данных размещены у хостинг-провайдера Render (США); письма отправляются через сервис Brevo (ЕС). Пользуясь Сервисом, Пользователь соглашается на трансграничную передачу данных этим провайдерам. Оплата проходит на стороне Kaspi; данные карт Сервис не получает и не хранит.",
        ],
      },
      {
        h: "5. Сроки хранения и удаление",
        p: [
          "Данные аккаунта хранятся, пока аккаунт существует. Аккаунт можно удалить самому в профиле — вместе с ним удаляются связанные данные. Повторы матчей удаляются через 14 дней.",
          `Данные учеников урока учитель может попросить удалить, написав на ${SELLER.email}.`,
        ],
      },
      {
        h: "6. Дети",
        p: [
          "Ученики заходят на урок только с именем; советуем использовать имя без фамилии. Учитель или школа отвечает за наличие согласия родителей (законных представителей) на участие ребёнка.",
        ],
      },
      {
        h: "7. Права пользователя",
        p: [
          `Вы можете узнать, какие данные о вас хранятся, исправить или удалить их и отозвать согласие, написав на ${SELLER.email}. Ответим в течение 10 рабочих дней.`,
        ],
      },
      {
        h: "8. Cookies и хранилище браузера",
        p: [
          "Сайт хранит в браузере только токен входа, язык и громкость музыки (и токен урока для учеников). Рекламных и сторонних трекеров нет.",
        ],
      },
    ],
  },
  kz: {
    title: "Құпиялылық саясаты",
    updated: UPDATED.kz,
    sections: [
      {
        h: "1. Деректерді кім өңдейді",
        p: [
          `Дербес деректер операторы — ${SELLER.name.kz} (${SELLER.owner.kz}, ЖСН ${SELLER.iin}). Өңдеу «Дербес деректер және оларды қорғау туралы» Қазақстан Республикасының Заңына сәйкес жүргізіледі. Деректер бойынша сұрақтар: ${SELLER.email}.`,
        ],
      },
      {
        h: "2. Қандай деректер сақталады",
        p: [
          "Аккаунт: пайдаланушы аты, e-mail (қалауы бойынша), құпиясөз хэші (құпиясөздің өзі сақталмайды), аватар, таңдалған тіл.",
          "Ойын: рейтинг, матч нәтижелері мен қайталаулары (қайталаулар 14 күн сақталады), жетістіктер, PIXELS-ке сатып алулар, достар тізімі, тапсырма шешімдері.",
          "Сабақтар: оқушы кіргенде енгізген аты (тіркелусіз және байланыс деректерінсіз), оның шешімдері, талпыныстары мен уақыты; сабақ атаулары және мұғалімнің тапсырмалары.",
          "Жазылымға өтініштер: мектептің не курстың атауы, байланыс (телефон, WhatsApp немесе e-mail), түсініктеме.",
          "Техникалық деректер: IP-мекенжай және сұраулар уақыты — тек теріс пайдаланудан қорғау үшін, сервер журналдарында.",
        ],
      },
      {
        h: "3. Не үшін",
        p: [
          "Сервис жұмыс істеуі үшін: аккаунтқа кіру, матчтар, рейтинг, сабақтар мен мұғалім кестесі; e-mail арқылы құпиясөзді қалпына келтіру; өтініштер мен төлем бойынша байланыс; бұзудан және спамнан қорғау.",
          "Біз деректерді сатпаймыз, жарнама көрсетпейміз және төменде аталған, сайт оларсыз жұмыс істемейтін сервистерден басқа үшінші тұлғаларға бермейміз.",
        ],
      },
      {
        h: "4. Деректер қайда сақталады",
        p: [
          "Сервер мен дерекқор Render хостинг-провайдерінде (АҚШ) орналасқан; хаттар Brevo (ЕО) сервисі арқылы жіберіледі. Сервисті пайдалану арқылы Пайдаланушы деректердің осы провайдерлерге трансшекаралық берілуіне келіседі. Төлем Kaspi жағында өтеді; Сервис карта деректерін алмайды және сақтамайды.",
        ],
      },
      {
        h: "5. Сақтау мерзімі және жою",
        p: [
          "Аккаунт деректері аккаунт бар болғанша сақталады. Аккаунтты профильде өзіңіз жоя аласыз — онымен бірге байланысты деректер де жойылады. Матч қайталаулары 14 күннен кейін жойылады.",
          `Мұғалім сабақ оқушыларының деректерін жоюды ${SELLER.email} мекенжайына жазып сұрай алады.`,
        ],
      },
      {
        h: "6. Балалар",
        p: [
          "Оқушылар сабаққа тек атымен кіреді; тегінсіз атты қолдануға кеңес береміз. Баланың қатысуына ата-ананың (заңды өкілдердің) келісімі болуына мұғалім немесе мектеп жауап береді.",
        ],
      },
      {
        h: "7. Пайдаланушы құқықтары",
        p: [
          `${SELLER.email} мекенжайына жазып, сіз туралы қандай деректер сақталатынын біліп, оларды түзетуге не жоюға және келісімді кері қайтарып алуға болады. 10 жұмыс күні ішінде жауап береміз.`,
        ],
      },
      {
        h: "8. Cookies және браузер жады",
        p: [
          "Сайт браузерде тек кіру токенін, тілді және музыка қаттылығын (оқушылар үшін сабақ токенін) сақтайды. Жарнамалық және бөгде трекерлер жоқ.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: UPDATED.en,
    sections: [
      {
        h: "1. Who processes the data",
        p: [
          `The personal data operator is ${SELLER.name.en} (${SELLER.owner.en}, IIN ${SELLER.iin}). Data is processed under the Law of the Republic of Kazakhstan "On personal data and their protection". Questions about your data: ${SELLER.email}.`,
        ],
      },
      {
        h: "2. What we store",
        p: [
          "Account: username, e-mail (optional), a password hash (never the password itself), avatar, chosen language.",
          "Game: rating, match results and replays (replays are kept 14 days), achievements, PIXELS purchases, friends list, task solutions.",
          "Lessons: the name a student typed when joining (no account, no contacts), their solutions, attempts and times; lesson titles and the teacher's tasks.",
          "Subscription requests: school or course name, a contact (phone, WhatsApp or e-mail), a comment.",
          "Technical data: IP address and time of requests, only to fight abuse, in server logs.",
        ],
      },
      {
        h: "3. Why",
        p: [
          "To run the Service: logging in, matches, rating, lessons and the teacher's table; password reset by e-mail; contact about requests and payments; protection against break-ins and spam.",
          "We do not sell data, show ads or share data with third parties other than the services below, without which the site does not work.",
        ],
      },
      {
        h: "4. Where the data is kept",
        p: [
          "The server and database are hosted by Render (USA); e-mails are sent through Brevo (EU). By using the Service the User agrees to this cross-border transfer. Payments happen on Kaspi's side; the Service never receives or stores card details.",
        ],
      },
      {
        h: "5. Retention and deletion",
        p: [
          "Account data is kept while the account exists. You can delete your account yourself in the profile, together with the related data. Match replays are deleted after 14 days.",
          `A teacher can ask for their lesson students' data to be deleted by writing to ${SELLER.email}.`,
        ],
      },
      {
        h: "6. Children",
        p: [
          "Students join a lesson with a name only; we suggest a first name without a surname. The teacher or school is responsible for the parents' (legal guardians') consent to the child taking part.",
        ],
      },
      {
        h: "7. Your rights",
        p: [
          `You can ask which data about you is stored, have it corrected or deleted, and withdraw consent by writing to ${SELLER.email}. We answer within 10 business days.`,
        ],
      },
      {
        h: "8. Cookies and browser storage",
        p: [
          "The site keeps only the login token, the language and the music volume in your browser (and a lesson token for students). There are no ad or third-party trackers.",
        ],
      },
    ],
  },
};

const CONTACTS: Record<DocLang, Doc> = {
  ru: {
    title: "Контакты и реквизиты",
    updated: UPDATED.ru,
    sections: [
      { h: "Продавец", p: seller("ru") },
      {
        h: "Как с нами связаться",
        p: [
          `Вопросы, заявки школ, оплата и возвраты: ${SELLER.email} или ${SELLER.phone} (звонок, WhatsApp). Отвечаем в течение 2 рабочих дней.`,
        ],
      },
    ],
  },
  kz: {
    title: "Байланыс және деректемелер",
    updated: UPDATED.kz,
    sections: [
      { h: "Сатушы", p: seller("kz") },
      {
        h: "Бізбен қалай байланысуға болады",
        p: [
          `Сұрақтар, мектеп өтініштері, төлем және қайтару: ${SELLER.email} немесе ${SELLER.phone} (қоңырау, WhatsApp). 2 жұмыс күні ішінде жауап береміз.`,
        ],
      },
    ],
  },
  en: {
    title: "Contacts and seller details",
    updated: UPDATED.en,
    sections: [
      { h: "Seller", p: seller("en") },
      {
        h: "How to reach us",
        p: [
          `Questions, school requests, payments and refunds: ${SELLER.email} or ${SELLER.phone} (call, WhatsApp). We answer within 2 business days.`,
        ],
      },
    ],
  },
};

export const DOCS: Record<DocId, Record<DocLang, Doc>> = { offer: OFFER, privacy: PRIVACY, contacts: CONTACTS };

/** Russian and Kazakh have their own text; every other interface language reads the English one. */
export const docLang = (lang: string): DocLang => (lang === "ru" || lang === "kz" ? lang : "en");
