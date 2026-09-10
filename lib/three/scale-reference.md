# Earth Run — 尺度基准

更新：2026-09-10。游戏实体换算为 `1 米 = 0.0002 world units`，统一在 `world-scale.ts` 管理。人物、狗、船舶、地标、区域住宅、树木及街道道具共用该换算；不能再按镜头单独放大人物。

地球仍是压缩的旅游地图，半径 1 world unit，并非按真实地球半径制作的地理模拟器。城市间距离、地形及装饰天空层不应据此换算成实际地理里程。场景内实体的相对尺寸与地理地图压缩是两个不同层级。

## 人物和通用设计尺寸

- 人物：站立姿态总高 1.75 米（含帽子、鞋及描边）；动作可能改变动态包围盒。
- 狗：静态模型总高 0.75 米，猫 0.45 米；不是肩高。
- 通用货船：长 180、宽 28、总高 22 米。
- 通用客船：长 60、宽 12、总高 12 米。
- 渔船：长 18、宽 5、总高 8 米；帆船：长 12、宽 3.8、含桅杆高 16 米。
- 船舶尺寸是本游戏选用的设计规格，不代表所有同类船舶，也不是某一艘实船的测绘。总高含水下船体；船体原点是水线。
- 区域住宅：按样式采用 5–32 米总高；第二种楼高增加 3 米。保留地域外形，属于通用建筑，不是逐栋实测。
- 随身小艇约 3.6 米，小狗艇约 1.8 米，个人飞行器约 7 米。基础跑速 4.5 米/秒，跟随镜头后退 9–12 米、抬高 4–5 米。

## 地标高度基准

模型保持风格化网格和内部比例，以表中基准统一缩放；并非建筑测绘或 BIM 模型。除标明的局部参考，采用整体可见轮廓高度。

| 地标 | 基准（米） | 范围及来源 |
| --- | ---: | --- |
| 东京塔 | 333 | [东京塔官方](https://en.tokyotower.co.jp/plan/towerpedia/) |
| Hollywood 标志 | 13.716 | 字母高度 45 英尺；不含山坡，[官方](https://www.hollywoodsign.org/history/the-sign-prepares-for-its-100th-anniversary) |
| Willis Tower | 约 527 | 含天线，官方 1730 英尺取约值，[Skydeck](https://theskydeck.com/the-incredible-willis-tower/) |
| 自由女神像 | 92.9894 | 地面至火炬，含基座，[美国国家公园管理局](https://www.nps.gov/stli/learn/statue-of-liberty-facts.htm) |
| Elizabeth Tower | 约 96.3 | 塔体，[英国议会](https://www.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/towers-of-parliament/) |
| 埃菲尔铁塔 | 330 | 含顶部天线，[官方数据](https://www.toureiffel.paris/fr/le-monument/chiffres-cle) |
| 罗马斗兽场 | 约 48.5 | 风格化完整外墙高度；[罗马旅游局](https://turismoroma.it/it/node/1155) 描述为超过 48 米 |
| 圣索菲亚大教堂 | 55.6 | 中央穹顶高度，不是宣礼塔顶，[土耳其文化旅游部](https://www.ktb.gov.tr/EN-113776/ayasofya-hagia-sophia.html) |
| 哈利法塔 | 828 | 建筑顶点，[Emaar 官方资料](https://bk.emaar.com/en/assets/FACT-SHEET.pdf) |
| 印度门 | 42 | [印度旅游官方](https://www.prod.incredibleindia.gov.in/content/incredible-india-v2/en/destinations/delhi/india-gate.html) |
| 东方明珠 | 468 | [上海市政府](https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html) |

Hollywood 的山坡及圣索菲亚的宣礼塔仍属于模型，因此它们的整体包围盒高于表中局部参考高度。校验应检查相应参考部位，不能直接用整体包围盒替代。

## 校验与维护

已测量人物、狗、4 类船、11 个地标参考高度、11 类住宅。24 艘船的 14,400 个航行位置采样均位于海上且沿球面法线直立。建筑碰撞范围按缩放后的实际模型包围盒更新，当前布局无碰撞圆重叠。

`?models=original` 保留旧程序模型用于历史对比，不作为这套比例验收的标准。默认游戏路径使用新的统一尺度。
