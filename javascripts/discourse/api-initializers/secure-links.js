import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer("0.8", (api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const getHostnameFromConfig = (entry) => {
    let d = entry.trim().toLowerCase();
    try {
      const urlObj = new URL(d.startsWith('http') ? d : `http://${d}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      return d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
    }
  };

  const BLOCKED_LIST = safeSplit(settings.blocked_domains).map(getHostnameFromConfig);
  const INTERNAL_LIST = safeSplit(settings.internal_domains).map(getHostnameFromConfig);
  const TRUSTED_LIST = safeSplit(settings.excluded_domains).map(getHostnameFromConfig);
  const DANGEROUS_LIST = safeSplit(settings.dangerous_domains).map(getHostnameFromConfig);
  const RISKY_LIST = safeSplit(settings.risky_domains).map(getHostnameFromConfig);

  const matchesDomain = (urlStr, domainList) => {
    if (!urlStr) return false;
    try {
      const urlObj = new URL(urlStr); 
      const linkHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      return domainList.some(configHostname => linkHostname === configHostname || linkHostname.endsWith("." + configHostname));
    } catch (e) {
      return false; 
    }
  };

  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("/")) return true; 
      if (link.href.includes(window.location.hostname)) return true;
      if (matchesDomain(link.href, INTERNAL_LIST)) return true;
    } catch(e) { return false; }
    return false;
  };

  const openModal = (e, url, level) => {
    e.preventDefault();
    e.stopPropagation();
    modal.show(ExternalLinkConfirm, {
      model: {
        url: url,
        securityLevel: level,
        openInNewTab: settings.external_links_in_new_tab
      }
    });
  };
  
  // 兼容获取 i18n 文本
  const getI18nText = (key) => {
     try {
       return i18n(themePrefix(key));
     } catch(e) {
       return key; 
     }
  };

  const processLink = (link) => {
    // 【关键修复 1】如果已经处理过，或者属于大卡片/图片放大，则跳过
    // ⚠️ 注意：这里故意去掉了 inline-onebox，让“直接粘贴的链接”也能被正常附魔！
    if (link.dataset.securityLevel) return;
    if (
      link.classList.contains("mention") || 
      link.classList.contains("lightbox") || 
      link.classList.contains("attachment") || 
      link.classList.contains("onebox")
    ) return;

    const url = link.href;

    // --- 1. 拦截屏蔽域名 ---
    if (matchesDomain(url, BLOCKED_LIST)) {
      const span = document.createElement("span");
      span.classList.add("blocked-link"); 
      span.innerText = `[${getI18nText("secure_links.blocked_text")}]`;
      link.replaceWith(span);
      return;
    }

    // --- 2. 判定是否内部链接 ---
    if (isInternal(link)) {
      link.dataset.securityLevel = "internal"; 
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      return;
    }

    // --- 3. 白名单信任 ---
    if (matchesDomain(url, TRUSTED_LIST)) {
      link.dataset.securityLevel = "trusted"; 
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      return; 
    }

    // --- 4. 定级风险 ---
    let level = "normal";
    if (matchesDomain(url, DANGEROUS_LIST)) level = "dangerous";
    else if (matchesDomain(url, RISKY_LIST)) level = "risky";
    
    link.dataset.securityLevel = level;

    // --- 5. 游客与 TL0 拦截 ---
    if (!currentUser && settings.enable_anonymous_blocking) {
      const newLink = document.createElement("a");
      newLink.href = settings.anonymous_redirect_url || "/login";
      newLink.className = "restricted-link-login"; 
      newLink.innerText = getI18nText("secure_links.login_to_view");
      link.replaceWith(newLink);
      return;
    }

    if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
      const newLink = document.createElement("a");
      newLink.href = settings.tl0_redirect_url || "#";
      newLink.className = "restricted-link-tl0";
      newLink.innerText = getI18nText("secure_links.first_trust_level_to_view");
      link.replaceWith(newLink);
      return;
    }

    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");

    // --- 6. 正常弹窗绑定 ---
    if (level === "normal" && !settings.enable_exit_confirmation) return;

    // 防止因为 DOM 监视器频繁触发而重复绑定点击事件
    if (!link.dataset.hasShieldListener) {
       link.dataset.hasShieldListener = "true";
       link.addEventListener("click", (e) => openModal(e, url, level));
    }
  };

  // ==========================================
  // 🧩 官方生命周期挂载与防篡改监视器
  // ==========================================
  api.decorateCookedElement((element) => {
    if (!element) return;
    
    // 【第一波附魔】：首次同步解析常规链接
    element.querySelectorAll("a[href]").forEach(processLink);
    
    // 【关键修复 2】：防篡改监视器
    // 专门抓捕像 Callout (呼出框) 这种异步重写 DOM 的恶劣行为，在其重写完成后，瞬间重新附魔！
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.addedNodes) {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.tagName === 'A' && node.hasAttribute('href')) {
                processLink(node);
              } else {
                node.querySelectorAll("a[href]").forEach(processLink);
              }
            }
          });
        }
      });
    });
    
    // 只监视当前帖子的局部 DOM，对性能影响微乎其微
    observer.observe(element, { childList: true, subtree: true });
    
  }, { id: "secure-link-shield", onlyStream: true });
});
