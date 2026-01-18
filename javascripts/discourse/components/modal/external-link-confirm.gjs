import Component from "@glimmer/component";
import { action } from "@ember/object";
import DModal from "discourse/components/d-modal";
import DButton from "discourse/components/d-button";
import dIcon from "discourse-common/helpers/d-icon";
import { i18n } from "discourse-i18n";
import { inject as service } from "@ember/service";

export default class ExternalLinkConfirm extends Component {
  @service toaster;

  // --- 状态判断 ---
  get level() { return this.args.model.securityLevel; }
  get isDangerous() { return this.level === 'dangerous'; }
  get isRisky() { return this.level === 'risky'; }
  get isNormal() { return !this.isDangerous && !this.isRisky; }

  // --- 文本 ---
  get title() { return i18n(themePrefix("secure_links.leaving_confirmation_title")); }

  get badgeText() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.badge_dangerous")); 
    if (this.isRisky) return i18n(themePrefix("secure_links.badge_risky"));         
    return i18n(themePrefix("secure_links.badge_external"));                        
  }

  get descriptionText() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_warning"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_warning"));
    return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer")); 
  }

  get questionText() { return i18n(themePrefix("secure_links.leaving_confirmation_question")); }
  get destinationText() { return i18n(themePrefix("secure_links.leaving_confirmation_destination")); }
  get reportHintText() { return i18n(themePrefix("secure_links.leaving_confirmation_report_hint")); }
  
  get copyUrlLabel() { return i18n(themePrefix("secure_links.copy_url")); }
  get continueLabel() { return i18n(themePrefix("secure_links.continue")); }
  get cancelLabel() { return i18n("cancel"); }

  // --- 图标定义 (必须匹配 solid.scss 的 keys) ---
  get titleIcon() {
    if (this.isDangerous) return "skull";
    if (this.isRisky) return "triangle-exclamation";
    return "external-link-alt"; 
  }

  // --- 动作 ---
  @action
  proceed() {
    const { url, openInNewTab } = this.args.model;
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    this.args.closeModal();
  }

  @action
  copyUrl() {
    navigator.clipboard.writeText(this.args.model.url).then(() => {
       this.toaster.show(i18n(themePrefix("secure_links.copied")), { type: 'success' });
    });
  }

  <template>
    <DModal @title="" @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      <:body>
        
        {{!-- 自定义 Header --}}
        <div class="custom-modal-header">
          
          {{!-- 1. 标题内容 --}}
          <div class="header-center-content">
             {{!-- 图标 --}}
             <span class="header-icon-span">
                {{dIcon this.titleIcon}}
             </span>
             {{!-- 标题 --}}
             <span class="header-title">{{this.title}}</span>
             {{!-- 徽章 --}}
             <span class="type-badge {{this.level}}">{{this.badgeText}}</span>
          </div>
          
          {{!-- 2. 关闭按钮 (X) --}}
          <div class="header-close-btn">
             <DButton 
               @icon="times" 
               @action={{@closeModal}} 
               class="btn-flat icon-only" 
             />
          </div>
        </div>

        <div class="modal-body-container">
          <div class="main-alert-text">
            <p class="description">{{this.descriptionText}}</p>
            {{#if this.isNormal}}
               <p class="confirm-question">{{this.questionText}}</p>
            {{/if}}
            <p class="redirect-hint">{{this.destinationText}}</p>
          </div>

          <div class="url-preview">
            {{@model.url}}
          </div>

          {{#unless this.isDangerous}}
            <div class="report-hint-box">
              {{dIcon "flag"}}
              <span>{{this.reportHintText}}</span>
            </div>
          {{/unless}}
        </div>
      </:body>

      <:footer>
        <DButton
          @translatedLabel={{this.cancelLabel}} 
          @action={{@closeModal}}
          class="btn-flat"
        />

        {{#if this.isDangerous}}
          <DButton
            @translatedLabel={{this.copyUrlLabel}}
            @action={{this.copyUrl}}
            @icon="copy"
            class="btn-danger"
          />
        {{else}}
          <DButton
            @translatedLabel={{this.continueLabel}}
            @action={{this.proceed}}
            @icon="arrow-right"
            class={{if this.isRisky "btn-warning" "btn-primary"}}
          />
        {{/if}}
      </:footer>
    </DModal>
  </template>
}
