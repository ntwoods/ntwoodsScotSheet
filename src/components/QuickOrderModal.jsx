import { ModalShell } from './ModalShell.jsx'
import { SalesOrderForm } from './SalesOrderForm.jsx'

export function QuickOrderModal({
  onClose,
  scEmail,
  scName,
  scIdToken,
  dealers,
  gasBase,
  orderPostUrl,
  onOrderPunched,
  onToast,
}) {
  return (
    <ModalShell title="New Order" onClose={onClose} actions={null}>
      <SalesOrderForm
        mode="NEW"
        signedInEmail={scEmail}
        signedInName={scName}
        signedInIdToken={scIdToken}
        dealerOptions={dealers}
        scotApiBase={gasBase}
        orderPostUrl={orderPostUrl}
        onCancel={onClose}
        onToast={onToast}
        onSuccess={async ({ dealerName, orderId, response }) => {
          onClose?.()
          await Promise.resolve(onOrderPunched?.({ dealerName, orderId, response }))
        }}
      />
    </ModalShell>
  )
}
