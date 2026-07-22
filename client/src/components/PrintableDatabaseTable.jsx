import React from 'react';
import './PrintableDatabaseTable.css';

export default function PrintableDatabaseTable({
  title,
  subtitle,
  columns,
  rows,
  loading,
  noDataMessage = 'لا توجد بيانات للعرض',
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="printable-table-container">
      <div className="printable-table-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="printable-table-actions no-print">
          <button className="btn btn-primary" onClick={handlePrint}>طباعة الجدول</button>
        </div>
      </div>

      <div className="printable-table-body">
        {loading ? (
          <div className="table-loading">جاري التحميل...</div>
        ) : rows?.length ? (
          <div className="table-wrapper">
            <table className="printable-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.field}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id || `${row[columns[0]?.field]}-${Math.random()}`}>
                    {columns.map(col => (
                      <td key={col.field}>{col.render ? col.render(row) : row[col.field]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty">{noDataMessage}</div>
        )}
      </div>
    </div>
  );
}
