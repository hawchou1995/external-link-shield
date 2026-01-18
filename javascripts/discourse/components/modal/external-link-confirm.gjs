import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import { on } from "@ember/modifier";

// SVG Icons
const SVGS = {
  normal: '<svg viewBox="0 0 512 512" style="width:100%;height:100%;fill:#2196F3"><path d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM488,0h-128c-21.37,0-32.05,25.91-17,41l35.73,35.73L135,320.37a24,24,0,0,0,0,34L157.67,377a24,24,0,0,0,34,0L435.28,133.32,471,169c15,15,41,4.5,41-17V24A24,24,0,0,0,488,0Z"/></svg>',
  risky: '<svg viewBox="0 0 512 512" style="width:100%;height:100%;fill:#D97706"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>',
  dangerous: '<svg viewBox="0 0 512 512" style="width:100%;height:100%;fill:#D32F2F"><path d="M416 398.9c58.8-26.1 96-85.1 96-150.9C512 137.3 397.3 48 256 48S0 137.3 0 248c0 65.8 37.2 124.8 96 150.9V424c0 22.1 17.9 40 40 40h72c0 26.5 21.5 48 48 48s48-21.5 48-48h72c22.1 0 40-17.9 40-40V398.9zM192 256c0-17.7 14.3-32 32-32s32 14.3 32 32-14.3 32-32 32-32-14.3-32-32zm128 32c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"/></svg>',
  times: '<svg viewBox="0 0 384 512" style="width:100%;height:100%;fill:#888"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s-12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>',
  flag: '<svg viewBox="0 0 448 512" style="width:100%;height:100%;fill:#888"><path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32V64 368 480c0 17.7 14.3 32 32 32s32-14.3 32-32V352l64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30V66.1c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48V32z"/></svg>'
};

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  get level() { return this.args.model.securityLevel || 'normal'; }
  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }
  get isNormal() { return this.level === 'normal'; }

  get title() { return i18n(themePrefix("secure_links.leaving_confirmation_title")); }
  
  get badgeText() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.badge_dangerous"));
    if (this.isRisky) return i18n(themePrefix("secure_links.badge_risky"));
    return i18n(themePrefix("secure_links.badge_external"));
  }
  
  get btnCancel() { return i18n("cancel"); }
  get btnCopy() { return i18n(themePrefix("secure_links.copy_url")); }
  get btnContinue() { return i18n(themePrefix("secure_links.continue")); }

  get description() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_warning"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_warning"));
    return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer"));
  }

  get iconSvg() {
    if (this.isDangerous) return htmlSafe(SVGS.dangerous);
    if (this.isRisky) return htmlSafe(SVGS.risky);
    return htmlSafe(SVGS.normal);
  }
  get closeSvg() { return htmlSafe(SVGS.times); }
  get flagSvg() { return htmlSafe(SVGS.flag); }

  @action
  close() { this.args.closeModal(); }

  @action
  proceed() {
    const { url, openInNewTab } = this.args.model;
    // 强制新标签页逻辑
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    this.close();
  }

  @action
  copy() {
    navigator.clipboard.writeText(this.args.model.url);
    // 修复报错：安全调用 toaster
    if (this.toaster && this.toaster.show) {
      this.toaster.show(i18n(themePrefix("secure_links.copied")), { type: 'success' });
    } else {
      // Fallback
      alert(i18n(themePrefix("secure_links.copied")));
    }
  }

  <template>
    <DModal @title="" @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        <div class="custom-header">
          <div class="header-content">
            <span class="header-icon">{{this.iconSvg}}</span>
            <span class="header-title">{{this.title}}</span>
            <span class="header-badge {{this.level}}">{{this.badgeText}}</span>
          </div>
          <button class="close-btn" {{on "click" this.close}} type="button">
            {{this.closeSvg}}
          </button>
        </div>

        {{!-- 重命名 class 以防止 Discourse 默认样式隐藏内容 --}}
        <div class="shield-modal-body">
          <p class="desc">{{this.description}}</p>
          
          {{#if this.isNormal}}
            <p style="font-weight:bold; margin-bottom: 8px; color: var(--primary);">
              {{i18n (themePrefix "secure_links.leaving_confirmation_question")}}
            </p>
          {{/if}}

          <div class="url-box">{{@model.url}}</div>

          {{#unless this.isDangerous}}
            <div class="report-hint">
              <span style="width:1em;height:1em;display:inline-block;vertical-align:-2px">{{this.flagSvg}}</span>
              {{i18n (themePrefix "secure_links.leaving_confirmation_report_hint")}}
            </div>
          {{/unless}}
        </div>
      </:body>

      <:footer>
        <div class="shield-modal-footer">
          <DButton @translatedLabel={{this.btnCancel}} @action={{this.close}} class="btn-flat" />
          
          {{#if this.isDangerous}}
            <DButton @translatedLabel={{this.btnCopy}} @action={{this.copy}} @icon="copy" class="btn-danger" />
          {{else}}
            <DButton 
              @translatedLabel={{this.btnContinue}} 
              @action={{this.proceed}} 
              @icon="arrow-right" 
              class={{if this.isRisky "btn-warning" "btn-primary"}} 
            />
          {{/if}}
        </div>
      </:footer>
    </DModal>
  </template>
}
