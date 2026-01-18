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

  // --- 文本 Getters ---
  get title() {
    return i18n(themePrefix("secure_links.leaving_confirmation_title"));
  }

  // ✨ 新增：徽章文本 (Badge Text)
  get badgeText() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_title")); // "危险链接"
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_title"));       // "可疑链接"
    return i18n(themePrefix("secure_links.external_label"));                      // "外部链接" (需在yml补充)
  }

  // 描述文本
  get descriptionText() {
    if (this.isDangerous) return i18n(themePrefix("secure_links.dangerous_warning"));
    if (this.isRisky) return i18n(themePrefix("secure_links.risky_warning"));
    return i18n(themePrefix("secure_links.leaving_confirmation_disclaimer")); 
  }

  get questionText() { return i18n(themePrefix("secure_links.leaving_confirmation_question")); }
  get destinationText() { return i18n(themePrefix("secure_links.leaving_confirmation_destination")); }
  get reportHintText() { return i18n(themePrefix("secure_links.leaving_confirmation_report_hint")); }
  
  // 按钮文本
  get copyUrlLabel() { return i18n(themePrefix("secure_links.copy_url")); }
  get continueLabel() { return i18n(themePrefix("secure_links.continue")); }
  get cancelLabel() { return i18n("cancel"); }

  // --- 图标与样式 ---
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
    <DModal @closeModal={{@closeModal}} class="external-link-modal {{this.level}}">
      
      {{!-- ✨ 核心修复：使用 <:title> 插槽自定义标题栏 --}}
      <:title>
        <div class="custom-modal-title">
          {{!-- 图标 --}}
          <span class="title-icon">
            {{dIcon this.titleIcon}}
          </span>
          
          {{!-- 标题文本 --}}
          <span class="title-text">{{this.title}}</span>
          
          {{!-- 类型徽章 (Pill Badge) --}}
          <span class="type-badge {{this.level}}">
            {{this.badgeText}}
          </span>
        </div>
      </:title>

      <:body>
        <div class="modal-body-container">
          
          {{!-- 核心提示文本 --}}
          <div class="main-alert-text">
            <p class="description">{{this.descriptionText}}</p>
            
            {{#if this.isNormal}}
               <p class="confirm-question">{{this.questionText}}</p>
            {{/if}}
            
            <p class="redirect-hint">
               {{this.destinationText}}
            </p>
          </div>

          {{!-- URL 预览胶囊 --}}
          <div class="url-preview">
            {{@model.url}}
          </div>

          {{!-- 举报提示 --}}
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
