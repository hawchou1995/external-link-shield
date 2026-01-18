import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    return safeSplit(domainString).some(d => url.includes(d.trim()));
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
        securityLevel: level, // 关键：传递安全等级
        openInNewTab: settings.external_links_in_new_tab
      }
    });
  };

  api.decorateCookedElement((element) => {
    if (!element) return;

    const links = element.querySelectorAll("a[href]");
    links.forEach(link => {
      // 排除特殊链接
      if (link.classList.contains("mention") || link.classList.contains("lightbox") || link.classList.contains("attachment")) return;

      const url = link.href;

      // 1. 屏蔽 (Blocked) -> 替换文本
      if (matchesDomain(url, settings.blocked_domains)) {
        const span = document.createElement("span");
        span.classList.add("blocked-link");
        span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
        span.title = url;
        link.replaceWith(span);
        return;
      }

      // 2. 内部 (Internal) -> 跳过
      if (isInternal(link)) return;

      // 3. 判定等级
      let level = "normal";
      if (matchesDomain(url, settings.dangerous_domains)) level = "dangerous";
      else if (matchesDomain(url, settings.risky_domains)) level = "risky";
      else if (matchesDomain(url, settings.excluded_domains)) {
        // Trusted -> 放行，不处理
        return;
      }

      // 4. 未登录拦截 / TL0 拦截
      if (!currentUser && settings.enable_anonymous_blocking) {
        const loginLink = document.createElement("a");
        loginLink.href = settings.anonymous_redirect_url || "/login";
        loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
        loginLink.classList.add("restricted-link-login");
        link.replaceWith(loginLink);
        return;
      }

      if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
        const tlLink = document.createElement("a");
        tlLink.href = settings.tl0_redirect_url || "#";
        tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
        link.replaceWith(tlLink);
        return;
      }

      // 5. 绑定点击事件 (Trusted 已在上面 return，不会走到这里)
      // 如果是 Normal 且关闭了确认，也不绑定
      if (level === "normal" && !settings.enable_exit_confirmation) return;

      // 清除旧事件并绑定新事件
      link.removeEventListener("click", link._shieldHandler);
      link._shieldHandler = (e) => openModal(e, url, level);
      link.addEventListener("click", link._shieldHandler);
    });
  }, { id: "secure-link-shield", onlyStream: true });
});
