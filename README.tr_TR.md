<!--
EL-UI
Proje lideri ve bakım sorumlusu: ArmanEleven
Bu proje Sanaei 3X-UI kod tabanını temel alır. LICENSE dosyasını ve üst proje bildirimlerini inceleyin.
-->

<p align="center">
  <strong>EL-UI</strong>
</p>

<h1 align="center">EL-UI — 3X-UI için Rol Tabanlı Yönetim Katmanı</h1>

<p align="center">
  <em><a href="https://github.com/ArmanEleven">ArmanEleven</a> tarafından geliştirilir ve sürdürülür</em>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.fa_IR.md">فارسی</a> ·
  <a href="README.it_IT.md">Italiano</a> ·
  <a href="README.zh_CN.md">简体中文</a> ·
  <a href="README.ru_RU.md">Русский</a> ·
  <a href="README.tr_TR.md">Türkçe</a>
</p>

<p align="center">
  <img alt="Proje durumu: deneysel" src="https://img.shields.io/badge/status-experimental-orange">
  <img alt="Çekirdek: 3X-UI" src="https://img.shields.io/badge/core-3X--UI-blue">
  <img alt="Lisans: GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-informational">
</p>

**EL-UI**, **ArmanEleven** liderliğinde geliştirilen açık kaynaklı bir projedir. Amacı, [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) kod tabanının üzerinde daha temiz ve kapsamlı bir yönetim deneyimi oluşturmaktır. Hedef Xray protokol motorunu değiştirmek değil; mevcut panelin temel yeteneklerini korurken yöneticiler, roller, izinler, kotalar ve operasyonel görünürlük için ayrı bir yönetim katmanı geliştirmektir.

> [!WARNING]
> **EL-UI geliştirme aşamasındadır ve üretim ortamına hazır bir sürüm değildir.** Çoklu yönetici katmanı henüz kimlik doğrulama, API yetkilendirmesi ve kullanıcı arayüzüne uçtan uca bağlanmamıştır. Bu geliştirme dalını üretim sunucularını veya önemli verileri yönetmek için kullanmayın.

## Proje hedefleri

- **Çekirdeği korumak:** 3X-UI'nin Xray, inbound, istemci, abonelik, trafik ve düğüm iş akışlarını sürdürmek.
- **Gerçek çoklu yönetici desteği:** Her yöneticiye bağımsız kimlik, rol, durum ve sunucu tarafında uygulanan erişim kapsamı sağlamak.
- **Rol tabanlı izinler:** Açık `NONE`, `OWN` ve `ALL` kapsamlarını kullanmak; açıkça izin verilmeyen işlemleri varsayılan olarak reddetmek.
- **Kotaları sunucuda denetlemek:** Kullanıcı sayısı, trafik/veri, sona erme, HWID ve tanımlı diğer sınırları yalnızca formlarda göstermek yerine backend işlemlerinde uygulamak.
- **Sahiplik sınırlarını korumak:** Yöneticilerin kendi rollerinin izin vermediği kayıtları okumasını veya değiştirmesini engellemek.
- **Denetlenebilir ve geri alınabilir değişiklikler:** Güvenli veritabanı geçişleri, yedekleme/geri yükleme kontrolleri, anlaşılır operasyon günlükleri ve regresyon testleri eklemek.
- **Kendine özgü bir arayüz geliştirmek:** Çok dilli ve sağdan sola (RTL) yerleşimi destekleyen, erişilebilir ve duyarlı bir yönetim arayüzü oluşturmak.

## Güncel geliştirme durumu

Çalışmalar şu anda `feature/rbac-foundation` dalında yürütülüyor.

| Alan | Durum |
|---|---|
| Geliştirme dalındaki 3X-UI çekirdek kaynak kodu | Mevcut; EL-UI sürümünün tam doğrulaması bekleniyor |
| İlk RBAC modelleri ve izin kontrolleri | Eklendi; birim testleri yazıldı |
| Ayrı yönetim rolü ve yönetici veritabanı modelleri | Eklendi ve şema geçişine kaydedildi |
| SQLite ↔ PostgreSQL geçiş modeli listesi | Yeni yönetim tablolarını içerecek şekilde güncellendi |
| Bağımsız yönetici girişi ve oturum kimliği | Henüz uygulanmadı |
| Gerçek yönetim API'lerinde izin denetimi | Henüz uygulanmadı |
| Rol ve yönetici yönetim arayüzü | Henüz uygulanmadı |
| Tam derleme, entegrasyon testleri ve güvenli yükseltme doğrulaması | Bekliyor |

Bir veritabanı modelinin veya arayüz ekranının bulunması, özelliğin tamamlandığı anlamına gelmez. Her özellik uygulamaya bağlanmalı ve tekrarlanabilir testlerle doğrulanmalıdır. Bu dalın tüm CI durumu henüz doğrulanmadı.

## Planlanan özellikler

### 1. Yöneticiler ve roller

- Tam denetime sahip bir Owner hesabı.
- İkincil yöneticiler için bağımsız hesaplar.
- Yönetici hesaplarını oluşturma, düzenleme, devre dışı bırakma ve yönetme.
- Kaynak ve işlem bazında ayrı izinlere sahip yapılandırılabilir roller.
- `NONE`, `OWN` ve `ALL` erişim kapsamları.
- Owner'a özel işlemlerden ayrılmış yönetici portalı.

### 2. Kotalar ve erişim politikası

- Her yönetici için oluşturulabilecek kullanıcı/istemci sayısı üst sınırı.
- Trafik/veri ve sona erme aralıkları için alt ve üst sınırlar.
- Çekirdeğin desteklediği yerlerde HWID politikası ve kullanıcı başına cihaz sınırları.
- İzin verilen grup ve şablon listeleri.
- Kısıtlanmış veya devre dışı yöneticiler için tanımlı davranış.
- Sınır değerleri ve eşzamanlı istekler için testlerle desteklenen sunucu tarafı kontroller.

### 3. İşletim ve güvenilirlik

- Hassas yönetici işlemleri için denetim kayıtları.
- Güvenli ve sürümlenmiş veritabanı geçişleri.
- Sürüm öncesi yedekleme ve geri yükleme testleri.
- SQLite ile PostgreSQL arasındaki veri geçişi kapsamı.
- Doğrudan API istekleri, sahiplik izolasyonu, devre dışı hesaplar ve kota denetimi için entegrasyon testleri.
- Kurulum, yükseltme, geri alma ve sorun giderme belgeleri.

Bunlar proje hedefleridir; tüm özelliklerin şimdiden kullanılabildiği anlamına gelmez.

## Mimari

EL-UI, protokol ve Xray çekirdeği olarak yerel 3X-UI kod tabanını kullanır. Planlanan yönetim katmanı, yönetim politikalarının çekirdek istemci mantığını veya çalışma zamanı işlemlerini atlamamasını sağlayacak açık sınırlar üzerine kurulacaktır.

- **Çekirdek:** [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) — Xray yaşam döngüsü, inbound'lar, istemciler, abonelikler ve düğüm işlemleri.
- **Protokol motoru:** [Xray-core](https://github.com/XTLS/Xray-core).
- **Backend:** Go, Gin ve GORM.
- **Frontend:** React, TypeScript, Vite ve Ant Design.
- **Çekirdekten devralınan veritabanı seçenekleri:** SQLite ve PostgreSQL.
- **RBAC davranış referansı:** [PasarGuard](https://github.com/PasarGuard/panel) içinde kamuya açık şekilde belgelenmiş kavramlar. EL-UI uygulaması bağımsız geliştirilmektedir; bu, PasarGuard kaynak kodunun yeniden kullanıldığı anlamına gelmez.

Ayrıntılar için [mimari önerisini](docs/ELUI-ARCHITECTURE.md), [kaynak kodu denetimini](docs/SOURCE_AUDIT.md) ve [özellik uyumluluk matrisini](docs/FEATURE_MATRIX.md) inceleyin.

## Geliştirme

Araç sürümleri depo manifestleriyle eşleşmelidir. Mevcut dal Go 1.27.2; frontend için Node.js 26 veya üzeri ve npm 11 veya üzeri sürümleri belirtir.

Go testleri:

```bash
go test ./...
```

Frontend kontrollerini `frontend/` dizininde çalıştırın:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

Bunlar katkıda bulunanlar için önerilen komutlardır ve **mevcut dalın tüm CI kontrollerini geçtiğini göstermez**. Testleri geçici veritabanları ve test sunucularında çalıştırın; üretim veritabanında geçiş denemeleri yapmayın.

## Güvenlik ve veri bütünlüğü

- İzinleri backend'de uygulayın; bir düğmeyi gizlemek yetkilendirme değildir.
- Sahiplik kısıtlarını yalnızca arayüzde değil, veritabanı sorgularında uygulayın.
- Parolaları, API token'larını, abonelik sırlarını veya maskelenmemiş hassas verileri günlüklere yazmayın.
- Dağıtımdan önce geçişleri ve geri yüklemeyi test verileriyle doğrulayın.
- Üst projelerin telif bildirimlerini koruyun ve geçerli lisans koşullarına uyun; [LICENSE](LICENSE) dosyasına bakın.
- Olası güvenlik açıklarını mümkün olduğunda özel bir kanal üzerinden bildirin; [SECURITY.md](SECURITY.md) dosyasını inceleyin.

## Proje liderliği ve teşekkürler

**Proje lideri ve bakım sorumlusu:** [ArmanEleven](https://github.com/ArmanEleven).

EL-UI, [Sanaei 3X-UI](https://github.com/MHSanaei/3x-ui) ve [Xray-core](https://github.com/XTLS/Xray-core) projelerinin çalışmalarını temel alır. İlgili bakım sorumlularına ve katkıda bulunanlara açıkça atıfta bulunmak önemlidir. PasarGuard'da belgelenmiş yönetim davranışları da işlevsel bir referans olarak incelenir.

## Lisans

EL-UI dağıtılırken üst kaynak kodunun lisans gereklilikleri ve bildirimleri korunmalıdır. Projeyi değiştirmeden veya yeniden dağıtmadan önce [LICENSE](LICENSE) dosyasını inceleyin.

---

<p align="center">
  <sub><a href="https://github.com/ArmanEleven">ArmanEleven</a> tarafından tasarlanır ve sürdürülür · Abartılı vaatler yerine doğrulanabilir doğruluk.</sub>
</p>
