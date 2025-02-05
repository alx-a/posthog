import React, { ReactElement, RefObject, useEffect, useRef, useState } from 'react'
import { Select, Tag, Tooltip } from 'antd'
import { RefSelectProps, SelectProps } from 'antd/lib/select'
import { CloseButton } from './CloseButton'
import { toString } from 'lib/utils'
import './SelectGradientOverflow.scss'

interface DropdownGradientRendererProps {
    updateScrollGradient: () => void
    innerRef: RefObject<HTMLDivElement>
    menu: ReactElement
}

function DropdownGradientRenderer({
    updateScrollGradient,
    innerRef,
    menu,
}: DropdownGradientRendererProps): JSX.Element {
    useEffect(() => {
        updateScrollGradient()
    })
    return <div ref={innerRef}>{menu}</div>
}

/**
 * Ant Design Tag with custom styling in .scss to match default style
 */
type CustomTagProps = Parameters<Exclude<SelectProps<any>['tagRender'], undefined>>[0]

function CustomTag({ label, onClose, value }: CustomTagProps): JSX.Element {
    return (
        <Tooltip title={toString(value)}>
            <Tag>
                <span className="label">{label}</span>
                <CloseButton onClick={onClose} />
            </Tag>
        </Tooltip>
    )
}

/**
 * Ant Design Select extended with a gradient overlay to indicate a scrollable list.
 */

const BUILT_IN_PLACEMENTS = {
    // https://github.com/react-component/select/blob/dade915d81069b8d3b3b5679bb9daee7e992faba/src/SelectTrigger.jsx#L11-L28
    bottomLeft: {
        points: ['tl', 'bl'],
        offset: [0, 4],
        overflow: {
            adjustX: 0,
            adjustY: 0,
        },
    },
    topLeft: {
        points: ['bl', 'tl'],
        offset: [0, -4],
        overflow: {
            adjustX: 0,
            adjustY: 0,
        },
    },
}

export type SelectGradientOverflowProps = SelectProps<any> & {
    delayBeforeAutoOpen?: number
    dropdownMatchSelectWidth?: boolean | number
    placement?: 'bottomLeft' | 'topLeft' // Dropdown placement (undefined = auto). See API at https://ant.design/components/dropdown
}

export function SelectGradientOverflow({
    autoFocus = false,
    defaultOpen = false,
    delayBeforeAutoOpen,
    dropdownMatchSelectWidth = true,
    placement,
    ...props
}: SelectGradientOverflowProps): JSX.Element {
    const selectRef: React.RefObject<RefSelectProps> | null = useRef(null)
    const containerRef: React.RefObject<HTMLDivElement> = useRef(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [isOpen, setOpen] = useState(false)

    const updateScrollGradient = (): void => {
        const dropdown = dropdownRef.current
        if (!dropdown) {
            return
        }
        const holder: HTMLDivElement | null = dropdown.querySelector('.rc-virtual-list-holder')
        if (!holder) {
            return
        }
        if (holder.scrollTop > 0) {
            dropdown.classList.add('scrollable-above')
        } else {
            dropdown.classList.remove('scrollable-above')
        }
        if (holder.scrollHeight > holder.scrollTop + holder.offsetHeight) {
            holder.classList.add('scrollable-below')
        } else {
            holder.classList.remove('scrollable-below')
        }
    }

    const onFocus = (): void => {
        setTimeout(() => setOpen(true), delayBeforeAutoOpen || 0)
    }

    const onBlur = (): void => {
        if (isOpen) {
            setOpen(false)
        }
    }

    useEffect(() => {
        if (autoFocus || defaultOpen) {
            selectRef.current?.focus()
        }
    }, [autoFocus, defaultOpen])

    const outsideClickListener = (event: any): void => {
        if (!containerRef.current?.contains(event.target) && !dropdownRef.current?.contains(event.target) && isOpen) {
            selectRef.current?.blur()
        }
    }
    document.addEventListener('click', outsideClickListener)
    return (
        <div ref={containerRef} style={{ width: '100%' }}>
            <Select
                {...props}
                dropdownAlign={placement ? BUILT_IN_PLACEMENTS[placement] : undefined}
                ref={selectRef}
                open={isOpen}
                onFocus={onFocus}
                onBlur={onBlur}
                onPopupScroll={() => {
                    updateScrollGradient()
                }}
                tagRender={CustomTag}
                dropdownRender={(menu) => (
                    <DropdownGradientRenderer
                        menu={menu}
                        innerRef={dropdownRef}
                        updateScrollGradient={updateScrollGradient}
                    />
                )}
                dropdownMatchSelectWidth={dropdownMatchSelectWidth}
            >
                {props.children}
            </Select>
        </div>
    )
}
