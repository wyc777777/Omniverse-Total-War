# 页面切换卡顿优化 - 验证清单

## 核心功能验证
- [ ] #wallpaper-layer 元素存在于 body 中且位于最底部（z-index: -2）
- [ ] 开启壁纸时，背景图设置在 #wallpaper-layer 上而非 body 上
- [ ] 关闭壁纸后，#wallpaper-layer 无背景图且界面恢复正常
- [ ] body.body-wallpaper::before 暗角遮罩在壁纸模式下正常显示

## 过渡动画验证
- [ ] 页面过渡开始时，body 有 transition-active class
- [ ] 页面过渡结束后，transition-active class 被正确移除
- [ ] 过渡期间 .page.active 的 backdrop-filter 为 none
- [ ] 过渡结束后 .page.active 的 backdrop-filter 恢复为 blur(15px)
- [ ] 过渡期间卡片的 backdrop-filter 为 none
- [ ] 过渡结束后卡片的 backdrop-filter 恢复正常

## GPU 层管理验证
- [ ] 过渡进行中，参与过渡的页面元素有 will-change: opacity, transform
- [ ] 过渡结束后，页面元素的 will-change 属性被清理
- [ ] 多次切换页面后，无 will-change 残留导致的内存堆积

## 流畅度验证（主观评价）
- [ ] 开启壁纸时，Prep → Shop 切换流畅无明显掉帧
- [ ] 开启壁纸时，Prep → Barracks 切换流畅无明显掉帧
- [ ] 开启壁纸时，Prep → Levels 切换流畅无明显掉帧
- [ ] 开启壁纸时，Prep → Summon 切换流畅无明显掉帧
- [ ] 开启壁纸时，Shop → Barracks → Levels 连续切换流畅
- [ ] 无壁纸时，各页面切换流畅度不逊于优化前
- [ ] Menu → Prep 切换流畅（粒子背景停止 + 壁纸启用）
- [ ] Prep → Menu 切换流畅（壁纸停用 + 粒子背景启动）

## 动画完整性验证
- [ ] 所有页面的 stagger 入场动画正常播放
- [ ] 卡片悬停效果（放大、阴影变化）正常
- [ ] 按钮悬停/点击动效正常
- [ ] 模态框入场/退场动画正常
- [ ] 设置页面的壁纸预览和切换功能正常
- [ ] 随机壁纸模式正常工作
- [ ] 召唤动画正常
- [ ] Toast 提示动画正常

## 静态视觉验证
- [ ] 优化前后静态截图对比无视觉差异（开启壁纸）
- [ ] 优化前后静态截图对比无视觉差异（关闭壁纸）
- [ ] 毛玻璃效果在静态时完全一致
- [ ] 卡片样式、文字颜色、间距均无变化

## 稳定性验证
- [ ] 快速连续点击不同页面，防抖逻辑正常，不会错乱
- [ ] 所有页面的 build 函数正常调用，内容完整显示
- [ ] 战斗页面进出正常，战斗功能不受影响
- [ ] 浏览器控制台无新增 JS 错误
- [ ] 长时间使用（10+ 次切换）无内存泄漏迹象
