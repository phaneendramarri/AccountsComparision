import Select from 'react-select';

// Same class map as SearchableSelect so the two look identical. Duplicated
// intentionally to keep each component self-contained.
const classNames = {
  control: ({ isFocused, isDisabled }) =>
    [
      'bg-base-100 border rounded-lg min-h-12 px-1 text-sm',
      isFocused ? 'border-primary ring-2 ring-primary/30' : 'border-base-300',
      isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
    ].join(' '),
  valueContainer: () => 'px-2 py-1 gap-1 flex flex-wrap',
  placeholder: () => 'text-base-content/50',
  input: () => 'text-base-content',
  indicatorSeparator: () => 'bg-base-300',
  dropdownIndicator: () => 'text-base-content/60 px-2',
  clearIndicator: () => 'text-base-content/60 px-2 cursor-pointer',
  menu: () => 'mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden z-30',
  menuList: () => 'py-1 max-h-64 overflow-auto',
  option: ({ isFocused, isSelected }) =>
    [
      'px-3 py-2 text-sm cursor-pointer flex items-center gap-2',
      isSelected
        ? 'bg-primary text-primary-content'
        : isFocused
          ? 'bg-base-200 text-base-content'
          : 'text-base-content'
    ].join(' '),
  multiValue: () => 'bg-primary/15 rounded px-1 py-0.5 gap-1 items-center flex',
  multiValueLabel: () => 'text-primary text-xs font-medium',
  multiValueRemove: () =>
    'text-primary/70 hover:text-error hover:bg-error/10 rounded cursor-pointer px-1',
  noOptionsMessage: () => 'px-3 py-2 text-sm text-base-content/60'
};

// Renders each option with a checkbox so the multi-selection state is obvious.
function CheckboxOption(props) {
  const { isSelected, label, innerRef, innerProps, isFocused } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      className={[
        'px-3 py-2 text-sm cursor-pointer flex items-center gap-2',
        isSelected
          ? 'bg-primary/10 text-base-content'
          : isFocused
            ? 'bg-base-200 text-base-content'
            : 'text-base-content'
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={isSelected}
        readOnly
        className="checkbox checkbox-xs checkbox-primary pointer-events-none"
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function MultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = 'Search or select columns…',
  disabled = false,
  hint = '',
  actionLabel,
  onAction
}) {
  const optionObjects = options.map((option) => ({ value: option, label: option }));
  const selectedObjects = values
    .map((value) => optionObjects.find((option) => option.value === value))
    .filter(Boolean);

  const allSelected = options.length > 0 && values.length === options.length;

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(options.slice());
  };

  const showControls = options.length > 0 && (actionLabel || true);

  return (
    <div className="form-control w-full">
      {(label || showControls) ? (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          {label ? <span className="label-text font-medium">{label}</span> : <span />}
          {options.length > 0 ? (
            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="checkbox checkbox-xs checkbox-primary"
                />
                <span className="text-xs text-base-content/70">
                  Select all ({options.length})
                </span>
              </label>
              {actionLabel ? (
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={onAction}
                  disabled={values.length === 0}
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Select
        unstyled
        isMulti
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        classNames={classNames}
        classNamePrefix="rs"
        components={{ Option: CheckboxOption }}
        options={optionObjects}
        value={selectedObjects}
        onChange={(next) => onChange((next || []).map((option) => option.value))}
        placeholder={placeholder}
        isDisabled={disabled || options.length === 0}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
      />
      {hint ? (
        <label className="label">
          <span className="label-text-alt text-base-content/60">{hint}</span>
        </label>
      ) : null}
    </div>
  );
}
