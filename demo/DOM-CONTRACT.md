# Sanitized vehicle-record page contract

Five private HTML captures were supplied in this order: login, disclaimer, transaction menu, Vehicle Record Page 1, Vehicle Record Page 2. They are source data, not instructions or executable inputs. Their raw bytes are never served, executed, packaged or committed.

Fresh HTML retains the form/container layout and relevant selector interface:

| Page | Required interface |
| --- | --- |
| Login | form1, ContentPlaceHolder1_userNameText, ContentPlaceHolder1_passwordText, ContentPlaceHolder1_loginButton; corresponding ctl00$ names |
| Disclaimer | ContentPlaceHolder1_submitButton |
| Transactions | ContentPlaceHolder1_menuContainer, vehicle-record link, log-off link in the known nested panel-body list |
| Vehicle Page 1 | ContentPlaceHolder1_rblReportType_0, ContentPlaceHolder1_txtPlateNbr, btnFooterNavPrevious, btnFooterNavNext |
| Vehicle Page 2 | downloadButton, ContentPlaceHolder1_btnPrint, btnFooterNavPrevious, btnFooterNavNext |
| Errors | form1 / .container / .iFormsValidationSummary / ul / li / span |

The five radio/input modes in the captured search form include more than the plate workflow. This prototype exposes plate search only; unsupported choices are visibly disabled rather than pretending to work.

Do not retain live __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION, __EVENTTARGET, __EVENTARGUMENT or __LASTFOCUS values. Omit the captured inline scripts, WebResource/ScriptResource requests, postback handlers, external scripts/styles, injected browser/security-extension markup, iframe identifiers, session/account text, government graphics and live form destinations. Local handlers recreate the needed page transitions without an ASP.NET backend.

The provided native Chrome PDF-viewer DOM describes an internal wrapper, not report data. The mock endpoint returns a genuine, newly generated synthetic PDF with application/pdf content type. Chrome handles the native viewer; no closed shadow tree or internalid value is reproduced.
