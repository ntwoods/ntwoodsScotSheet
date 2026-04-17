import { useMemo, useState } from 'react'
import { filesToOrderPayload_, submitSalesOrder } from '../lib/orderPunchApi.js'

function normalize_(s) {
  return String(s || '').trim().toLowerCase()
}

export function SalesOrderForm({
  mode,
  dealerFixedName,
  signedInEmail,
  signedInName,
  signedInIdToken,
  dealerOptions,
  orderPostUrl,
  scotApiBase,
  onSuccess,
  onCancel,
  onToast,
}) {
  const formMode = String(mode || '').toUpperCase() === 'OR' ? 'OR' : 'NEW'

  const [dealerSearch, setDealerSearch] = useState('')
  const [selectedDealer, setSelectedDealer] = useState('')
  const [dealerListOpen, setDealerListOpen] = useState(false)
  const [marketingPersonName, setMarketingPersonName] = useState('')
  const [dealerLocation, setDealerLocation] = useState('')
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  void scotApiBase

  const dealerList = useMemo(
    () =>
      (dealerOptions || [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [dealerOptions],
  )

  const dealerSet = useMemo(() => new Set(dealerList.map((x) => normalize_(x))), [dealerList])

  const selectedDealerName =
    formMode === 'OR' ? String(dealerFixedName || '').trim() : String(selectedDealer || '').trim()

  const filteredDealers = useMemo(() => {
    const needle = normalize_(dealerSearch)
    if (!needle) return dealerList.slice(0, 100)
    return dealerList.filter((d) => normalize_(d).includes(needle)).slice(0, 100)
  }, [dealerSearch, dealerList])

  const validate = () => {
    const next = {}
    if (!String(signedInEmail || '').trim()) next.auth = 'Signed-in user email is missing.'
    if (!selectedDealerName) {
      next.dealerName = 'Please select an existing dealer from the list.'
    } else if (formMode === 'NEW' && !dealerSet.has(normalize_(selectedDealerName))) {
      next.dealerName = 'Only existing dealers can be selected.'
    }
    if (!String(marketingPersonName || '').trim()) next.marketingPersonName = 'Marketing Person Name is required.'
    if (!String(dealerLocation || '').trim()) next.dealerLocation = 'Dealer Location is required.'
    if (!Array.isArray(files) || !files.length) next.files = 'At least one file is required.'
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      const filePayload = await filesToOrderPayload_(files)
      const payload = {
        dealerName: selectedDealerName,
        marketingPersonName: String(marketingPersonName || '').trim(),
        dealerLocation: String(dealerLocation || '').trim(),
        files: filePayload,
        punchedByEmail: String(signedInEmail || '').trim().toLowerCase(),
        punchedByName: String(signedInName || '').trim(),
        id_token: String(signedInIdToken || '').trim(),
      }

      const result = await submitSalesOrder({ orderPostUrl, payload })

      onToast?.('Order submitted successfully.')
      await Promise.resolve(
        onSuccess?.({
          dealerName: selectedDealerName,
          orderId: String(result?.orderId || '').trim(),
          response: result,
        }),
      )
    } catch (err) {
      const msg = err?.message || 'Order submit failed'
      setSubmitError(msg)
      onToast?.(`Order submit failed: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="salesOrderForm" onSubmit={handleSubmit}>
      {errors.auth ? <div className="fieldError">{errors.auth}</div> : null}
      {submitError ? <div className="fieldError">{submitError}</div> : null}

      <div className="field">
        <label>Dealer Name</label>
        {formMode === 'OR' ? (
          <input type="text" value={selectedDealerName} disabled readOnly />
        ) : (
          <>
            <div className="dealerSearchWrap">
              <input
                type="text"
                value={dealerSearch}
                onChange={(ev) => {
                  setDealerSearch(ev.target.value)
                  setDealerListOpen(true)
                }}
                onFocus={() => setDealerListOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setDealerListOpen(false), 120)
                }}
                placeholder="Search existing dealer"
                autoComplete="off"
                disabled={submitting}
              />
              {dealerListOpen ? (
                <div className="dealerSearchList">
                  {filteredDealers.length ? (
                    filteredDealers.map((dealer) => (
                      <button
                        type="button"
                        key={dealer}
                        className={`dealerSearchItem${selectedDealer === dealer ? ' active' : ''}`}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setSelectedDealer(dealer)
                          setDealerSearch(dealer)
                          setDealerListOpen(false)
                          setErrors((prev) => ({ ...prev, dealerName: '' }))
                        }}
                      >
                        {dealer}
                      </button>
                    ))
                  ) : (
                    <div className="dealerSearchEmpty">No matching dealer found in your existing list.</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="hint">Only existing dealers from your SCOT mapping can be selected.</div>
            {selectedDealerName ? <div className="hint">Selected Dealer: {selectedDealerName}</div> : null}
          </>
        )}
        {errors.dealerName ? <div className="fieldError">{errors.dealerName}</div> : null}
      </div>

      <div className="field">
        <label>Marketing Person Name</label>
        <input
          type="text"
          value={marketingPersonName}
          onChange={(ev) => setMarketingPersonName(ev.target.value)}
          disabled={submitting}
        />
        {errors.marketingPersonName ? <div className="fieldError">{errors.marketingPersonName}</div> : null}
      </div>

      <div className="field">
        <label>Dealer Location</label>
        <input type="text" value={dealerLocation} onChange={(ev) => setDealerLocation(ev.target.value)} disabled={submitting} />
        {errors.dealerLocation ? <div className="fieldError">{errors.dealerLocation}</div> : null}
      </div>

      <div className="field">
        <label>File Upload (Multiple files)</label>
        <input
          type="file"
          multiple
          onChange={(ev) => setFiles(Array.from(ev.target.files || []))}
          disabled={submitting}
        />
        {files.length ? <div className="hint">{files.length} file(s) selected</div> : null}
        {errors.files ? <div className="fieldError">{errors.files}</div> : null}
      </div>

      <div className="modalActions salesFormActions">
        <button type="button" className="btn btnLight" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btnPrimary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
