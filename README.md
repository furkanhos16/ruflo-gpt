# Ruflo GPT

**Ruflo'nun GPT/Codex için topluluk uyarlaması.**

Projeye özel kalıcı hafıza, yerel anlamsal arama ve oturumlar arasında devam eden görev takibi. [Ruflo](https://github.com/ruvnet/ruflo) 3.63.0 üzerine kurulmuş, Codex'e 16 araç sunan bir MCP bağdaştırıcısıdır.

Bu proje Fazlı Furkan Hoş ([furkanhos16](https://github.com/furkanhos16)) tarafından yayımlanan bağımsız bir uyarlamadır. OpenAI veya Ruflo'nun resmî ürünü değildir. GPT modeli içermez; Codex gibi yerel MCP istemcilerine hafıza ve görev araçları sağlar.

## Ne değişti?

- **Projeye göre ayrılmış kayıtlar:** Her araç açık bir `project_path` alır. Farklı projeler farklı depolar kullanır; sembolik bağlantılar aynı gerçek proje yoluna çözülür.
- **Sohbetler arasında güvenilir yazma:** Linux dosya kilidi, aynı projede birden fazla istemci çalışırken görev kayıtlarının birbirini ezmesini önler.
- **Codex'e uygun iş akışı:** Claude'a özel kancalar yerine açık görev başlangıcı/sonu adımları olan bir Codex skill'i gelir.
- **Gerçek yerel arama:** ONNX gömme modeli kullanılır. Sahte/hash gömme yedeği reddedilir. Arama çıktısı, kullanılan gerçek depolama yöntemini bildirir.
- **Doğrulanan araç girişleri:** Şema doğrulaması, boyut sınırları ve MCP hata yanıtları eklenmiştir.
- **Düzeltilmiş görev özeti:** İptal edilen görevler de toplam ve durum sayılarına dahil edilir.

Görev kaydı açmak işi veya bir ajanı çalıştırmaz. İşi Codex'in kendi araçları yürütür. Skill, kalıcı kişisel hafızaya yazmayı kullanıcının açık isteğine bağlar; sohbet veya hesap verilerini otomatik içeri aktarmaz.

## Kurulum

Şu an **Linux, Node.js 20.9+ ve `/usr/bin/flock`** gereklidir. Doğrulanan ortam Linux + Node.js 22'dir. Windows ve macOS desteği bu sürümde yoktur.

```sh
git clone https://github.com/furkanhos16/ruflo-gpt.git
cd ruflo-gpt
npm ci --ignore-scripts
npm test
npm run setup
```

Bağımlılık ağacı büyüktür; test edilen kurulum yaklaşık 1,6 GB yer kaplar. `--ignore-scripts` kurulum sırasında bağımlılıkların otomatik betiklerini çalıştırmaz. İlk anlamsal hafıza işlemi/test model dosyalarını indirmek için internet isteyebilir. Sonraki işlemler önbelleğe alınan modelle yerelde çalışır. Testler model yoksa sahte başarı bildirmez.

`npm run setup`, bu bilgisayardaki gerçek Node ve depo yollarıyla `.ruflo-setup/mcp-config.toml` ve `.ruflo-setup/ruflo-codex/` üretir. **Mevcut Codex ayarlarını değiştirmez.**

1. Üretilen TOML bloğunu Codex kullanıcı ayar dosyanıza ekleyin: varsayılan `~/.codex/config.toml`, özel `CODEX_HOME` kullanılıyorsa onun içindeki `config.toml`. `ruflo` zaten tanımlıysa ikinci blok eklemek yerine mevcut tanımı gözden geçirin ve önce yedekleyin.
2. Üretilen `ruflo-codex` klasörünü Codex kullanıcı skill dizinine kopyalayın: varsayılan `~/.codex/skills/`. Aynı adlı skill varsa önce yedekleyin.
3. Yeni bir Codex oturumunda `ruflo` araçlarını kontrol edin. Bu depo klasörünü taşımayın/silmeyin; taşınırsa yapılandırmayı yeniden üretin.

MCP henüz açık sohbette görünmüyorsa aynı işlevler yerel komut satırından kullanılabilir:

```sh
node cli.mjs tools
node cli.mjs codex_status '{"project_path":"/absolute/path/to/your/project"}'
```

Her çağrıda var olan **mutlak proje yolu** kullanılmalıdır. Karmaşık metinlerde JSON'u `node cli.mjs <tool_name> -` komutuna standart girdiden verin.

## 16 araç

| Grup | Araçlar |
| --- | --- |
| Durum | `codex_status` |
| Hafıza | `memory_store`, `memory_retrieve`, `memory_search`, `memory_delete`, `memory_list`, `memory_stats` |
| Görevler | `task_create`, `task_status`, `task_list`, `task_complete`, `task_update`, `task_assign`, `task_cancel`, `task_retry`, `task_summary` |

`task_retry` eski `taskId` ile yeni `newTaskId` döndürür; yeni denemeye `newTaskId` üzerinden devam edin. Zaman aşımına uğrayan bir yazmanın sonucu belirsiz olabilir; yeniden oluşturmadan önce mevcut kaydı kontrol edin.

## Veri ve sınırlar

- Varsayılan yerel depo: `~/.local/share/ruflo-codex/state/projects/<proje-yolu-hash'i>/`. `RUFLO_CODEX_STATE_DIR` ile kök dizin değiştirilebilir.
- Proje yolu `project.json` içinde, hafıza ve görevler yerel dosyalarda saklanır. Dosyalar şifreli değildir; sırlar ve kimlik bilgileri için bir kasa değildir.
- Bu bağdaştırıcı model sağlayıcılarına istek atmaz ve ek bir model API anahtarı gerektirmez. Codex'in kendi hesabı/aboneliği ayrı çalışır. İlk model indirmesi yerel arama için gerekebilir.
- Gömme modeli ağırlıklı olarak İngilizcedir. Türkçe karakterler ve yapılandırılmış veri saklama test edildi; geniş kapsamlı Türkçe anlamsal arama başarımı ölçülmedi.
- Ruflo'nun tüm araçlarını veya özelliklerini taşımaz. Bu sürüm yalnızca listelenen 16 aracı kapsar. Zamanlayıcı, otomatik ajan ordusu veya arka planda çalışan servis kurmaz.
- Yerel stdio MCP kullanır. Tarayıcıdaki ChatGPT'ye doğrudan kurulabilen bir eklenti veya barındırılan uzak MCP hizmeti değildir.

## Doğrulama

`npm test`, gerçek bir MCP istemcisi ve geçici proje depoları ile 14 bütünleşme kontrolü çalıştırır. El sıkışma ve araç listesi, Türkçe veri saklama, süreç yeniden başlatılınca kalıcılık, proje ayrımı, sembolik yollar, gerçek anlamsal arama, görev yaşam döngüsü, geçersiz girişler, eşzamanlı yazmalar ve hafıza istatistikleri kapsanır. 16 aracın tamamı çağrılır. Test sonunda geçici kayıtlar silinir.

```sh
node test.mjs test-results.json
```

Geliştirme sırasında bağımlılık sürümlerini değiştirdiğinizde testleri yeniden çalıştırın. Kilit dosyasındaki bağımlılıklar bu sürümün bir parçasıdır.

**Bilinen bağımlılık uyarıları:** 26 Ekim 2026 taramasında kritik uyarı kalmadı; upstream bağımlılık ağacında 9 yüksek ve 21 orta düzey kayıt devam ediyor. Bunlar geçişli bağımlılıkları da sayan npm sonuçlarıdır. İşlev testlerinin geçmesi güvenlik denetiminin temiz olduğu anlamına gelmez. Ayrıntılar ve uygulanan sürüm sabitlemeleri için [SECURITY.md](SECURITY.md).

## Lisans ve kaynak

Bağdaştırıcı kodu [MIT](LICENSE) lisanslıdır. Ruflo'nun özgün çalışması ve telif bildirimi [UPSTREAM-LICENSE](UPSTREAM-LICENSE) içinde korunmuştur. Bağımlılıkların kendi lisansları ayrıca geçerlidir.

Kaynak proje: [ruvnet/ruflo](https://github.com/ruvnet/ruflo). Bu uyarlama, Ruflo'nun görev ve hafıza bileşenlerini kullanır; özgün projeyi kendisine mal etmez.

## English

Ruflo GPT is an unofficial, Linux-focused GPT/Codex adaptation of Ruflo 3.63.0. It exposes 16 local MCP tools for project-isolated memory and durable task tracking. It adds canonical project scoping, cross-process file locking, validated inputs, honest backend reporting, and a Codex workflow skill. It does not execute agents, host a GPT model, or provide a remote ChatGPT connector. See the installation commands above; `npm run setup` generates local configuration without changing your existing Codex settings.
