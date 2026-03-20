import { apiInitializer } from "discourse/lib/api";
// 引入你原有的弹窗组件，路径请根据你的实际情况保持一致
import ExternalLinkConfirm from "../components/modal/external-link-confirm"; 

export default apiInitializer("0.8", (api) => {
  
  // ==========================================
  // 🧩 模块 1：外部链接判定引擎 (零信任假设)
  // ==========================================
  const isExternalLink = (aElement) => {
    if (!aElement.href) return false;
    
    // 排除相对路径、锚点、邮件或 JS 协议
    if (aElement.getAttribute('href').startsWith('/') || 
        aElement.href.startsWith("javascript:") || 
        aElement.href.startsWith("mailto:") || 
        aElement.href.startsWith("#")) {
      return false;
    }
    
    try {
      const targetUrl = new URL(aElement.href, window.location.origin);
      const currentHost = window.location.hostname;
      
      // 核心判断：域名是否不同
      return targetUrl.hostname !== currentHost;
    } catch (e) {
      return false; // 无法解析的 URL 一律放过，防崩
    }
  };

  // ==========================================
  // 🧩 模块 2：UI 防御与组件豁免矩阵
  // ==========================================
  const shouldIgnore = (aElement) => {
    // 黑名单类名：只要 A 标签或其父级含有这些特征，就不当做普通文字外链处理
    // inline-onebox: 一行内的网站标题链接
    // mention: @用户
    // lightbox: 图片放大框
    const ignoreClasses = ['mention', 'hashtag', 'attachment', 'lightbox', 'inline-onebox', 'badge-category__wrapper'];
    
    const hasIgnoreClass = ignoreClasses.some(c => aElement.classList.contains(c));
    // 排除富媒体卡片区块内部的链接
    const insideComplexBlock = aElement.closest('.onebox') || aElement.closest('.quote') || aElement.closest('.video-container');
    
    return hasIgnoreClass || insideComplexBlock;
  };

  // ==========================================
  // 🧩 模块 3：官方生命周期挂载与 DOM 注入
  // ==========================================
  api.decorateCookedElement((element, helper) => {
    // 仅在实际的帖子/消息块中寻找链接
    const links = element.querySelectorAll("a");
    
    links.forEach((a) => {
      // 通过两道网关：确实是外链，且不属于特殊 UI 组件
      if (isExternalLink(a) && !shouldIgnore(a)) {
        
        // 🧪 内置验证点：标记该元素已被护盾接管，防止多次执行重复注入
        if (a.dataset.shieldApplied === "true") return;
        a.dataset.shieldApplied = "true";

        // 注入小图标。如果你觉得官方图标库里没有 up-right-from-square，也可以换成 external-link-alt
        const iconHtml = `<svg class="fa d-icon d-icon-up-right-from-square svg-icon external-link-icon" style="margin-left:4px; margin-bottom:2px; width:12px; height:12px; opacity:0.6; vertical-align:middle;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#up-right-from-square"></use></svg>`;
        a.insertAdjacentHTML('beforeend', iconHtml);
        
        // 🚨 防御性编程：绑定点击拦截
        a.addEventListener("click", (e) => {
          e.preventDefault();   // 阻断原生跳转
          e.stopPropagation();  // 防止触发外层元素的冒泡
          
          try {
            const targetHost = new URL(a.href).hostname;
            // 调用你的 GJS Modal 组件
            const modal = api.container.lookup("service:modal");
            modal.show(ExternalLinkConfirm, {
               model: {
                 url: a.href,
                 host: targetHost
               }
            });
          } catch(err) {
            // 如果 URL 解析极度异常，保底直接跳转以防卡死
            window.open(a.href, '_blank', 'noopener,noreferrer');
          }
        });
      }
    });
  }, {
    id: "endfield-external-link-shield-core" // 命名空间标识，极重要，防止 SPA 架构下重复执行
  });
});
