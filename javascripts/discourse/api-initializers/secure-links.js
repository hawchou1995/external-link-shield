import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    // 忽略大小写匹配
    return safeSplit(domainString).some(d => urlLower.includes(d.trim().toLowerCase()));
  };

  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("/") || href.startsWith("#")) return true;
      if (link.href.includes(window.location.hostname)) return true;
      if (matchesDomain(link.href, settings.internal_domains)) return true;
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

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");
      
      links.forEach(link => {
        if (
          link.classList.contains("mention") || 
          link.classList.contains("lightbox") || 
          link.classList.contains("attachment") || 
          link.classList.contains("onebox")
        ) return;

        const url = link.href;

        // --- 优先级 1: 屏蔽域名 (Blocked) ---
        // 行为：链接被替换为文本，且不保留原始URL在DOM中
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); // CSS 添加 Ban 图标
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          // ⚠️ 关键：这里不设置 span.title，所以在 F12 中看不到原链接
          link.replaceWith(span);
          return;
        }

        // --- 优先级 2: 内部域名 (Internal) ---
        if (isInternal(link)) return;

        // --- 优先级 3: 受信任域名 (Trusted) ---
        // 🌟 修复：只要是信任域名，直接放行，不进行登录检查
        if (matchesDomain(url, settings.excluded_domains)) {
          return; // CSS 会自动添加绿锁图标
        }

        // --- 优先级 4: 判定等级 (Risky / Dangerous / Normal) ---
        let level = "normal";
        if (matchesDomain(url, settings.dangerous_domains)) {
          level = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          level = "risky";
        }
        link.dataset.securityLevel = level;

        // --- 优先级 5: 登录/权限拦截 (仅针对 非内部、非受信任 链接) ---
        
        // 未登录拦截
        if (!currentUser && settings.enable_anonymous_blocking) {
          const loginLink = document.createElement("a");
          loginLink.href = settings.anonymous_redirect_url || "/login";
          loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          loginLink.classList.add("restricted-link-login");
          link.replaceWith(loginLink);
          return;
        }

        // TL0 拦截
        if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
          const tlLink = document.createElement("a");
          tlLink.href = settings.tl0_redirect_url || "#";
          tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
          tlLink.classList.add("restricted-link-tl0");
          link.replaceWith(tlLink);
          return;
        }

        // TL1 手动查看
        if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "#";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.classList.add("secure-links-reveal");
          
          button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.innerHTML = link.innerHTML;
            realLink.dataset.securityLevel = level;
            realLink.addEventListener("click", (ev) => openModal(ev, url, level));
            button.replaceWith(realLink);
          });
          link.replaceWith(button);
          return;
        }

        // --- 优先级 6: 绑定弹窗 ---
        if (level === "normal" && !settings.enable_exit_confirmation) return;

        link.addEventListener("click", (e) => openModal(e, url, level));
      });

    } catch (e) {
      console.error("[Link Shield] Error:", e);
    }
  }, { id: "secure-link-shield", onlyStream: true });
});
