# Güvenlik ve bağımlılıklar

Bu sürüm yerel stdio MCP kullanımı için bir topluluk uyarlamasıdır. İnternete açık, çok kullanıcılı bir hizmet olarak test edilmemiştir. Güvenilmeyen istemcilere sunmayın. Proje ayrımı bir erişim kontrol sistemi değildir: istemci var olan başka bir yerel proje yolunu seçebilir.

## 26 Ekim 2026 kontrolü

İlk sabitlenmiş Ruflo 3.63.0 bağımlılık ağacında `npm audit` 1 kritik, 15 yüksek ve 22 orta düzey kayıt bildirdi. Bu depoda aşağıdaki açık sürüm sabitlemeleri uygulanmıştır:

| Bağımlılık | Sürüm | Amaç |
| --- | --- | --- |
| `protobufjs` | 7.6.6 | Eski 6.x bağımlılığındaki kod yürütme ve sonraki ayrıştırma uyarılarını gidermek |
| `sharp` | 0.35.5 | Eski libvips/libheif/librsvg uyarılarını gidermek |
| `@opentelemetry/propagator-jaeger` | 2.9.0 | Bozuk başlık işleme uyarısını gidermek |
| `@opentelemetry/core` (yalnızca 2.x talepleri) | 2.9.0 | 2.x baggage işleme uyarısını gidermek |

Sonuç: **0 kritik, 9 yüksek, 21 orta**. Sayılar npm'in etkilenen üst paketleri de dahil ettiği bağımlılık kayıtlarıdır; 30 ayrı özgün açık anlamına gelmez. Kalan doğrudan danışma kayıtları şunlardır:

- [Zod: büyük kısıtlı koleksiyonlarla bellek tüketimi](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Upstream bileşenler Zod 3 kullanıyor; her şeyi Zod 4'e zorlamak desteklenmeyen bir ana sürüm değişimi olur. Bağdaştırıcının dış girdileri Ajv şemaları ve toplam girdi sınırıyla kontrol edilir; tüm geçişli yollar için erişilebilirlik denetimi yapılmadı.
- [OpenTelemetry Core: W3C baggage bellek ayırma](https://github.com/advisories/GHSA-8988-4f7v-96qf). Eski 1.x zinciri upstream'de devam ediyor. Bu bağdaştırıcı uzak HTTP hizmeti veya telemetri sağlayıcısı başlatmaz; tüm geçişli yollar için erişilebilirlik denetimi yapılmadı.

Sürüm sabitlemelerinden sonra 16 aracın tamamını kapsayan 14 MCP bütünleşme kontrolü tekrar geçti. Ruflo'nun diğer özellikleri bu uyarlamanın test kapsamına dahil değildir. `npm audit fix --force` otomatik uygulanmamalıdır; önerilen Ruflo sürümü geriye götürüp davranışı değiştirebilir.

Hafıza ve görev dosyaları yerelde ve şifresizdir. Anahtarları, parolaları veya kişisel kayıtları herkese açık hata bildirimlerine eklemeyin. Yeniden üretim adımları içeren, sırları çıkarılmış bir issue açılabilir.
